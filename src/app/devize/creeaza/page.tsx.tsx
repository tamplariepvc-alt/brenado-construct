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

  const [lines, setLines] = useState<DevizLine[]>([{ service_id: "", quantity: "" }]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [showServicePicker, setShowServicePicker] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("id, full_name, role").eq("id", user.id).single();
      if (!profileData) { router.push("/login"); return; }

      const [projectsRes, servicesRes] = await Promise.all([
        supabase.from("projects").select("id, name, beneficiary, status")
          .neq("status", "finalizat").order("created_at", { ascending: false }),
        supabase.from("services").select("id, name, um, price_ron")
          .eq("is_active", true).order("name"),
      ]);

      setProfile(profileData as Profile);
      setProjects((projectsRes.data as Project[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.toLowerCase().trim();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, serviceSearch]);

  const total = useMemo(() =>
    lines.reduce((sum, line) => {
      const svc = serviceMap.get(line.service_id);
      return sum + Number(line.quantity || 0) * Number(svc?.price_ron || 0);
    }, 0),
    [lines, serviceMap]
  );

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setBeneficiary(project.beneficiary || "");
      setSiteName(project.name);
    }
  };

  const addLine = () => setLines((prev) => [...prev, { service_id: "", quantity: "" }]);
  const removeLine = (index: number) =>
    setLines((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  const updateLine = (index: number, field: "service_id" | "quantity", value: string) =>
    setLines((prev) => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));

  const selectService = (lineIndex: number, serviceId: string) => {
    updateLine(lineIndex, "service_id", serviceId);
    setShowServicePicker(null);
    setServiceSearch("");
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
      await new Promise((resolve) => { logo.onload = resolve; logo.onerror = resolve; });
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
        return [String(index + 1), service?.name || "-", service?.um || "-", String(quantity), `${price.toFixed(2)} lei`, `${lineTotal.toFixed(2)} lei`];
      });

    autoTable(doc, {
      startY: 68,
      head: [["Nr.", "Serviciu", "UM", "Cantitate", "Pret unitar", "Total"]],
      body: rows,
      foot: [["", "", "", "", "TOTAL", `${pdfTotal.toFixed(2)} lei`]],
      styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
      headStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: "grid",
    });

    const finalY = (doc as any).lastAutoTable.finalY || 68;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Semnatura executant:", 14, finalY + 22);

    try {
      const stampila = new window.Image();
      stampila.src = "/stampila.png";
      await new Promise((resolve) => { stampila.onload = resolve; stampila.onerror = resolve; });
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
    if (!beneficiary.trim()) { alert("Completează beneficiarul."); return; }
    if (!siteName.trim()) { alert("Completează șantierul."); return; }
    const validLines = lines.filter((l) => l.service_id && Number(l.quantity || 0) > 0);
    if (validLines.length === 0) { alert("Adaugă cel puțin un articol cu cantitate."); return; }

    setSaving(true);

    const { data: estimateData, error: estimateError } = await supabase
      .from("estimates")
      .insert({
        project_id: selectedProjectId || null,
        beneficiary: beneficiary.trim(),
        site_name: siteName.trim(),
        created_by: profile.id,
      })
      .select("id").single();

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

    if (itemsError) { alert(`Eroare: ${itemsError.message}`); setSaving(false); return; }

    setSaving(false);
    await exportPdf(validLines, beneficiary, siteName, estimateDate);
    router.push("/devize");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-700" />
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* Service picker modal */}
      {showServicePicker !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-t-[24px] border border-[#E8E5DE] bg-white shadow-2xl sm:rounded-[24px]">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <p className="text-base font-bold text-gray-900">Alege serviciu</p>
              <button
                type="button"
                onClick={() => { setShowServicePicker(null); setServiceSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="px-4 pt-3">
              <input
                autoFocus
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Caută serviciu..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
              />
            </div>
            <div className="max-h-72 overflow-y-auto px-4 pb-4 pt-2">
              {filteredServices.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">Nu s-a găsit niciun serviciu.</p>
              ) : (
                <div className="space-y-1">
                  {filteredServices.map((svc) => {
                    const isSelected = lines[showServicePicker]?.service_id === svc.id;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => selectService(showServicePicker, svc.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
                          isSelected
                            ? "bg-green-700 text-white"
                            : "bg-[#F8F7F3] text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-sm font-medium">{svc.name}</span>
                        <span className={`shrink-0 text-xs ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                          {svc.um} · {svc.price_ron.toFixed(2)} lei
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button
            onClick={() => router.push("/devize")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-700 sm:h-7 sm:w-7">
                <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Devize lucrări</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Deviz nou
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Completează datele, adaugă articolele și exportă PDF.
              </p>
            </div>
          </div>
        </section>

        {/* Date deviz */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Date deviz</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Proiect activ (opțional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              >
                <option value="">Fără proiect asociat</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.beneficiary ? ` — ${p.beneficiary}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Beneficiar</label>
              <input
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Nume beneficiar"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Șantier / lucrare</label>
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: Montaj tâmplărie PVC"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Data devizului</label>
              <input
                type="date"
                value={estimateDate}
                onChange={(e) => setEstimateDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>
          </div>
        </section>

        {/* Articole */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Articole</p>
              <div className="h-px w-8 bg-[#E8E5DE]" />
              <span className="text-xs font-semibold text-gray-400">{lines.length}</span>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              + Adaugă
            </button>
          </div>

          {/* Header tabel — vizibil pe desktop */}
          <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <div className="col-span-5">Serviciu</div>
            <div className="col-span-2 text-center">Cantitate</div>
            <div className="col-span-2 text-center">UM</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => {
              const selectedSvc = serviceMap.get(line.service_id);
              const lineTotal = Number(line.quantity || 0) * Number(selectedSvc?.price_ron || 0);

              return (
                <div key={index} className="rounded-2xl border border-gray-200 bg-[#F8F7F3]">
                  {/* Mobile layout */}
                  <div className="flex items-center gap-2 p-3 sm:hidden">
                    <div className="flex-1 space-y-2">
                      {/* Selector serviciu */}
                      <button
                        type="button"
                        onClick={() => { setShowServicePicker(index); setServiceSearch(""); }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          selectedSvc
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-gray-200 bg-white text-gray-400"
                        }`}
                      >
                        <span className="truncate font-medium">
                          {selectedSvc ? selectedSvc.name : "Alege serviciu..."}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-gray-400">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {/* Cantitate + UM + Total pe un rând */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Cant.</p>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, "quantity", e.target.value)}
                            placeholder="0"
                            className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-500"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">UM</p>
                          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-600">
                            {selectedSvc?.um || "-"}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total</p>
                          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-bold text-green-700">
                            {lineTotal > 0 ? `${lineTotal.toFixed(0)} lei` : "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden items-center gap-2 p-2 sm:grid sm:grid-cols-12">
                    <div className="col-span-5">
                      <button
                        type="button"
                        onClick={() => { setShowServicePicker(index); setServiceSearch(""); }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          selectedSvc
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-gray-200 bg-white text-gray-400"
                        }`}
                      >
                        <span className="truncate font-medium">
                          {selectedSvc ? selectedSvc.name : "Alege serviciu..."}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-gray-400">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-center text-sm outline-none focus:border-gray-500"
                      />
                    </div>
                    <div className="col-span-2 text-center text-sm text-gray-500">
                      {selectedSvc?.um || "-"}
                    </div>
                    <div className="col-span-2 text-right text-sm font-bold text-green-700">
                      {lineTotal > 0 ? `${lineTotal.toFixed(2)} lei` : "-"}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-semibold text-green-900">Total deviz</p>
            <p className="text-xl font-extrabold text-green-700">{total.toFixed(2)} lei</p>
          </div>
        </section>

        {/* Butoane salvare */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
      </main>
    </div>
  );
}
