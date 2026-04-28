"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Profile = { id: string; full_name: string; role: string };
type Project = { id: string; name: string; beneficiary: string | null; status: string | null };
type Service = { id: string; name: string; um: string; price_ron: number };
type DevizLine = { service_id: string; quantity: string };

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function CreeazaDevizPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success" | "warning"; message: string } | null>(null);

  const showToast = (type: "error" | "success" | "warning", message: string, duration = 4000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [siteName, setSiteName] = useState("");
  const [estimateDate, setEstimateDate] = useState(getTodayDate());
  const [lines, setLines] = useState<DevizLine[]>([{ service_id: "", quantity: "" }]);

  const [pickerLineIndex, setPickerLineIndex] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profileData } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
      if (!profileData) { router.push("/login"); return; }
      const [projectsRes, servicesRes] = await Promise.all([
        supabase.from("projects").select("id, name, beneficiary, status").neq("status", "finalizat").order("created_at", { ascending: false }),
        supabase.from("services").select("id, name, um, price_ron").eq("is_active", true).order("name"),
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
    const p = projects.find((pr) => pr.id === projectId);
    if (p) { setBeneficiary(p.beneficiary || ""); setSiteName(p.name); }
  };

  const addLine = () => setLines((prev) => [...prev, { service_id: "", quantity: "" }]);
  const removeLine = (i: number) => setLines((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof DevizLine, value: string) =>
    setLines((prev) => prev.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const openPicker = (i: number) => { setPickerLineIndex(i); setServiceSearch(""); };
  const closePicker = () => { setPickerLineIndex(null); setServiceSearch(""); };
  const selectService = (serviceId: string) => {
    if (pickerLineIndex !== null) updateLine(pickerLineIndex, "service_id", serviceId);
    closePicker();
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
      await new Promise((r) => { logo.onload = r; logo.onerror = r; });
      doc.addImage(logo, "PNG", 14, 10, 42, 13);
    } catch {}
    doc.setDrawColor(21, 128, 61); doc.setLineWidth(0.6); doc.line(14, 28, 196, 28);
    doc.setFontSize(17); doc.setTextColor(20, 83, 45); doc.text("Deviz lucrari", 14, 38);
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(`Beneficiar: ${exportBeneficiary || "-"}`, 14, 45);
    doc.text(`Santier: ${exportSiteName || "-"}`, 14, 50);
    doc.text(`Data deviz: ${new Date(exportDate).toLocaleDateString("ro-RO")}`, 14, 55);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 60);
    let pdfTotal = 0;
    const rows = exportLines.filter((l) => l.service_id && Number(l.quantity || 0) > 0).map((l, i) => {
      const svc = serviceMap.get(l.service_id);
      const qty = Number(l.quantity || 0); const price = Number(svc?.price_ron || 0); const lt = qty * price;
      pdfTotal += lt;
      return [String(i + 1), svc?.name || "-", svc?.um || "-", String(qty), `${price.toFixed(2)} lei`, `${lt.toFixed(2)} lei`];
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
    doc.setFontSize(10); doc.setTextColor(0);
    doc.text("Semnatura executant:", 14, finalY + 22);
    try {
      const st = new window.Image(); st.src = "/stampila.png";
      await new Promise((r) => { st.onload = r; st.onerror = r; });
      doc.addImage(st, "PNG", 11, finalY + 26, 35, 28);
    } catch {}
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);
    doc.save(`deviz_${exportSiteName.replace(/\s+/g, "_")}_${exportDate}.pdf`);
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!beneficiary.trim()) { showToast("error", "Completează beneficiarul."); return; }
    if (!siteName.trim()) { showToast("error", "Completează șantierul."); return; }
    const validLines = lines.filter((l) => l.service_id && Number(l.quantity || 0) > 0);
    if (validLines.length === 0) { showToast("error", "Adaugă cel puțin un articol cu cantitate."); return; }
    setSaving(true);
    const { data: estimateData, error: estimateError } = await supabase.from("estimates").insert({
      project_id: selectedProjectId || null,
      beneficiary: beneficiary.trim(),
      site_name: siteName.trim(),
      created_by: profile.id,
    }).select("id").single();
    if (estimateError || !estimateData) { showToast("error", `Eroare la salvare: ${estimateError?.message}`); setSaving(false); return; }
    const { error: itemsError } = await supabase.from("estimate_items").insert(
      validLines.map((l) => {
        const svc = serviceMap.get(l.service_id);
        return { estimate_id: estimateData.id, service_id: l.service_id, quantity: Number(l.quantity), unit_price: Number(svc?.price_ron || 0) };
      })
    );
    if (itemsError) { showToast("error", `Eroare la salvarea articolelor: ${itemsError.message}`); setSaving(false); return; }
    setSaving(false);
    await exportPdf(validLines, beneficiary, siteName, estimateDate);
    router.push("/devize");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">

      {/* Picker bottom sheet — h-[90vh] pe mobil ca la comenzi */}
      {pickerLineIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closePicker}>
          <div
            className="flex h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[80vh] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle mobil */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <p className="text-base font-bold text-gray-900">Alege serviciu</p>
              <button type="button" onClick={closePicker}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 hover:bg-gray-200">
                ✕
              </button>
            </div>

            <div className="px-4 pb-2">
              <input
                autoFocus
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Caută serviciu..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
              />
            </div>

            {/* flex-1 — ocupă tot spațiul rămas */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {filteredServices.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Niciun serviciu găsit.</p>
              ) : (
                <div className="space-y-1">
                  {filteredServices.map((svc) => {
                    const isSelected = pickerLineIndex !== null && lines[pickerLineIndex]?.service_id === svc.id;
                    return (
                      <button key={svc.id} type="button" onClick={() => selectService(svc.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
                          isSelected ? "bg-green-700 text-white" : "hover:bg-gray-50"
                        }`}>
                        <div className="min-w-0 flex-1">
                          {/* break-words — nu mai iese din card */}
                          <span className={`block text-sm font-medium leading-snug break-words ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {svc.name}
                          </span>
                        </div>
                        <span className={`shrink-0 text-xs ml-2 ${isSelected ? "text-white/80" : "text-gray-400"}`}>
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

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${
            toast.type === "error" ? "border-red-300 bg-red-50 text-red-800"
            : toast.type === "success" ? "border-green-300 bg-green-50 text-green-800"
            : "border-yellow-300 bg-yellow-50 text-yellow-800"
          }`}>
            {toast.type === "error" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
            {toast.type === "success" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-600" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {toast.type === "warning" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-yellow-500" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              </svg>
            )}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/devize")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-700">
                <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Devize lucrări</p>
              <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Deviz nou</h1>
            </div>
          </div>
        </section>

        {/* Date generale */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Detalii</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Proiect (opțional)</label>
              <select value={selectedProjectId} onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400">
                <option value="">Fără proiect asociat</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.beneficiary ? ` — ${p.beneficiary}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Beneficiar</label>
              <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="Nume beneficiar"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Șantier / lucrare</label>
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: Montaj tâmplărie PVC"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Data devizului</label>
              <input type="date" value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" />
            </div>
          </div>
        </section>

        {/* Articole */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Articole deviz</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">{lines.length} {lines.length === 1 ? "articol" : "articole"}</p>
            </div>
            <button type="button" onClick={addLine}
              className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800">
              + Adaugă
            </button>
          </div>

          <div className="divide-y divide-[#F0EEE9]">
            {lines.map((line, index) => {
              const svc = serviceMap.get(line.service_id);
              const lineTotal = Number(line.quantity || 0) * Number(svc?.price_ron || 0);

              return (
                <div key={index} className="px-4 py-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
                      {index + 1}
                    </span>
                    {/* FIX: items-start + break-words — textul lung nu mai iese din card */}
                    <button type="button" onClick={() => openPicker(index)}
                      className={`flex flex-1 items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        svc ? "border-green-200 bg-green-50" : "border-gray-200 bg-[#F8F7F3]"
                      }`}>
                      <span className={`min-w-0 flex-1 break-words text-xs font-medium leading-snug ${svc ? "text-green-900" : "text-gray-400"}`}>
                        {svc ? svc.name : "Alege serviciu..."}
                      </span>
                      {svc && (
                        <span className="ml-1 shrink-0 text-xs text-green-600">{svc.um}</span>
                      )}
                    </button>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(index)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-400 hover:bg-red-100">
                        ×
                      </button>
                    )}
                  </div>

                  {svc && (
                    <div className="mt-2 flex items-center gap-3 pl-8">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Cant.</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, "quantity", e.target.value)}
                          placeholder="0"
                          className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-400"
                        />
                        <span className="text-xs font-medium text-gray-500">{svc.um}</span>
                      </div>
                      {lineTotal > 0 && (
                        <span className="ml-auto text-sm font-bold text-green-700">
                          {lineTotal.toFixed(2)} lei
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[#E8E5DE] px-5 py-4">
            <p className="text-sm font-semibold text-gray-700">Total deviz</p>
            <p className="text-xl font-extrabold text-green-700">{total.toFixed(2)} lei</p>
          </div>
        </section>

        {/* Buton */}
        <div>
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60">
            {saving ? "Se salvează..." : "Salvează și exportă PDF"}
          </button>
        </div>
      </main>
    </div>
  );
}
