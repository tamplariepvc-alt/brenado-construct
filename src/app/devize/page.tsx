"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Profile = {
  id: string;
  full_name: string;
  role: "administrator" | "sef_echipa" | "user";
};

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  status: string | null;
};

type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
};

type DevizLine = {
  service_id: string;
  quantity: string;
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function CreeazaDevizPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [siteName, setSiteName] = useState("");
  const [estimateDate, setEstimateDate] = useState(getTodayDate());

  const [lines, setLines] = useState<DevizLine[]>([
    { service_id: "", quantity: "" },
  ]);

  const [serviceSearchByLine, setServiceSearchByLine] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (!profileData) {
        router.push("/login");
        return;
      }

      const [projectsRes, servicesRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, beneficiary, status")
          .neq("status", "finalizat")
          .order("created_at", { ascending: false }),
        supabase
          .from("services")
          .select("id, name, um, price_ron")
          .eq("is_active", true)
          .order("name"),
      ]);

      setProfile(profileData as Profile);
      setProjects((projectsRes.data as Project[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const serviceMap = useMemo(() => {
    return new Map(services.map((service) => [service.id, service]));
  }, [services]);

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const service = serviceMap.get(line.service_id);
      return sum + Number(line.quantity || 0) * Number(service?.price_ron || 0);
    }, 0);
  }, [lines, serviceMap]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);

    const project = projects.find((p) => p.id === projectId);

    if (project) {
      setBeneficiary(project.beneficiary || "");
      setSiteName(project.name);
    }
  };

  const addLine = () => {
    setLines((prev) => [...prev, { service_id: "", quantity: "" }]);
  };

  const removeLine = (index: number) => {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );

    setServiceSearchByLine((prev) => {
      const next: Record<number, string> = {};

      Object.entries(prev).forEach(([key, value]) => {
        const numericKey = Number(key);

        if (numericKey < index) next[numericKey] = value;
        if (numericKey > index) next[numericKey - 1] = value;
      });

      return next;
    });
  };

  const updateLine = (
    index: number,
    field: "service_id" | "quantity",
    value: string
  ) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  };

  const exportPdf = async (
    exportLines = lines,
    exportBeneficiary = beneficiary,
    exportSiteName = siteName,
    exportDate = estimateDate
  ) => {
    const doc = new jsPDF("p", "mm", "a4");

    try {
      const logo = new window.Image();
      logo.src = "/logo.png";

      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve;
      });

      doc.addImage(logo, "PNG", 14, 10, 42, 13);
    } catch {}

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.6);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(17);
    doc.setTextColor(20, 83, 45);
    doc.text("Deviz lucrari", 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Beneficiar: ${exportBeneficiary || "-"}`, 14, 45);
    doc.text(`Santier: ${exportSiteName || "-"}`, 14, 50);
    doc.text(`Data deviz: ${new Date(exportDate).toLocaleDateString("ro-RO")}`, 14, 55);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 60);

    let pdfTotal = 0;

    const rows = exportLines
      .filter((line) => line.service_id && Number(line.quantity || 0) > 0)
      .map((line, index) => {
        const service = serviceMap.get(line.service_id);
        const quantity = Number(line.quantity || 0);
        const price = Number(service?.price_ron || 0);
        const lineTotal = quantity * price;

        pdfTotal += lineTotal;

        return [
          String(index + 1),
          service?.name || "-",
          service?.um || "-",
          String(quantity),
          `${price.toFixed(2)} lei`,
          `${lineTotal.toFixed(2)} lei`,
        ];
      });

    autoTable(doc, {
      startY: 68,
      head: [["Nr.", "Serviciu", "UM", "Cantitate", "Pret unitar", "Total"]],
      body: rows,
      foot: [["", "", "", "", "TOTAL", `${pdfTotal.toFixed(2)} lei`]],
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [20, 83, 45],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [20, 83, 45],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      theme: "grid",
    });

    const finalY = (doc as any).lastAutoTable.finalY || 68;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Semnatura executant:", 14, finalY + 22);

    try {
      const stampila = new window.Image();
      stampila.src = "/stampila.png";

      await new Promise((resolve) => {
        stampila.onload = resolve;
        stampila.onerror = resolve;
      });

      doc.addImage(stampila, "PNG", 11, finalY + 26, 35, 28);
    } catch {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Stampila indisponibila", 14, finalY + 30);
    }

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);

    doc.save(`deviz_${exportSiteName.replace(/\s+/g, "_")}_${exportDate}.pdf`);
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!beneficiary.trim()) {
      alert("Completează beneficiarul.");
      return;
    }

    if (!siteName.trim()) {
      alert("Completează șantierul.");
      return;
    }

    const validLines = lines.filter(
      (line) => line.service_id && Number(line.quantity || 0) > 0
    );

    if (validLines.length === 0) {
      alert("Adaugă cel puțin un articol cu cantitate.");
      return;
    }

    setSaving(true);

    const { data: estimateData, error: estimateError } = await supabase
      .from("estimates")
      .insert({
        project_id: selectedProjectId || null,
        beneficiary: beneficiary.trim(),
        site_name: siteName.trim(),
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (estimateError || !estimateData) {
      alert(`Eroare: ${estimateError?.message || "Nu s-a salvat devizul."}`);
      setSaving(false);
      return;
    }

    const { error: itemsError } = await supabase.from("estimate_items").insert(
      validLines.map((line) => {
        const service = serviceMap.get(line.service_id);

        return {
          estimate_id: estimateData.id,
          service_id: line.service_id,
          quantity: Number(line.quantity),
          unit_price: Number(service?.price_ron || 0),
        };
      })
    );

    if (itemsError) {
      alert(`Eroare: ${itemsError.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);

    await exportPdf(validLines, beneficiary, siteName, estimateDate);

    router.push("/devize");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
        <div className="rounded-[22px] border border-[#E8E5DE] bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          <p className="mt-4 text-sm font-semibold text-gray-700">
            Se încarcă...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={44}
            className="h-10 w-auto object-contain sm:h-11"
          />

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/devize")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Istoric devize
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm text-gray-500">Devize</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Creează deviz
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Completează datele lucrării, adaugă articolele și exportă PDF.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Alege proiect activ, opțional
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              >
                <option value="">Deviz fără proiect asociat</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.beneficiary || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Beneficiar
              </label>
              <input
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Nume beneficiar"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Șantier / lucrare
              </label>
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: Montaj tâmplărie PVC"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Data devizului
              </label>
              <input
                type="date"
                value={estimateDate}
                onChange={(e) => setEstimateDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Articole deviz
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">
                Servicii / lucrări
              </h2>
            </div>

            <button
              type="button"
              onClick={addLine}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              + Adaugă articol
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const selectedService = serviceMap.get(line.service_id);
              const searchValue = serviceSearchByLine[index] || "";
              const filteredServices = services
                .filter((service) =>
                  service.name.toLowerCase().includes(searchValue.toLowerCase())
                )
                .slice(0, 30);

              const lineTotal =
                Number(line.quantity || 0) * Number(selectedService?.price_ron || 0);

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-gray-200 bg-[#F8F7F3] p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="rounded-xl border border-gray-200 bg-white p-2">
                        <input
                          value={searchValue}
                          onChange={(e) => {
                            const value = e.target.value;

                            setServiceSearchByLine((prev) => ({
                              ...prev,
                              [index]: value,
                            }));

                            updateLine(index, "service_id", "");
                          }}
                          placeholder="Caută serviciu..."
                          className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-500"
                        />

                        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                          {filteredServices.map((service) => {
                            const selected = service.id === line.service_id;

                            return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => {
                                  updateLine(index, "service_id", service.id);

                                  setServiceSearchByLine((prev) => ({
                                    ...prev,
                                    [index]: service.name,
                                  }));
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                                  selected
                                    ? "bg-green-700 text-white"
                                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                <span className="font-medium">{service.name}</span>
                                <span
                                  className={
                                    selected ? "text-white/80" : "text-gray-400"
                                  }
                                >
                                  {service.um} · {service.price_ron.toFixed(2)} lei
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {filteredServices.length === 0 && (
                          <p className="px-2 py-2 text-xs text-gray-400">
                            Nu s-a găsit niciun serviciu.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-500">
                            Cantitate
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(index, "quantity", e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-500">
                            UM
                          </label>
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                            {selectedService?.um || "-"}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-500">
                            Total linie
                          </label>
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-green-700">
                            {lineTotal.toFixed(2)} lei
                          </div>
                        </div>
                      </div>
                    </div>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-green-900">
                Total deviz
              </p>
              <p className="text-xl font-extrabold text-green-700">
                {total.toFixed(2)} lei
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => exportPdf()}
              className="w-full rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
            >
              Export PDF fără salvare
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
            >
              {saving ? "Se salvează..." : "Salvează și exportă PDF"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}