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

type Estimate = {
  id: string;
  project_id: string | null;
  beneficiary: string;
  site_name: string;
  created_by: string;
  created_at: string;
};

type EstimateItem = {
  id: string;
  estimate_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
};

type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
};

export default function DevizePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("id, full_name, role").eq("id", user.id).single();
      if (!profileData) { router.push("/login"); return; }

      const estimatesQuery = profileData.role === "administrator"
        ? supabase.from("estimates")
            .select("id, project_id, beneficiary, site_name, created_by, created_at")
            .order("created_at", { ascending: false })
        : supabase.from("estimates")
            .select("id, project_id, beneficiary, site_name, created_by, created_at")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false });

      const [estimatesRes, itemsRes, servicesRes] = await Promise.all([
        estimatesQuery,
        supabase.from("estimate_items").select("id, estimate_id, service_id, quantity, unit_price"),
        supabase.from("services").select("id, name, um, price_ron"),
      ]);

      setProfile(profileData as Profile);
      setEstimates((estimatesRes.data as Estimate[]) || []);
      setItems((itemsRes.data as EstimateItem[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const serviceMap = useMemo(() =>
    new Map(services.map((s) => [s.id, s])),
    [services]
  );

  const filteredEstimates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return estimates;
    return estimates.filter((e) =>
      e.beneficiary.toLowerCase().includes(q) ||
      e.site_name.toLowerCase().includes(q)
    );
  }, [estimates, search]);

  const getEstimateItems = (estimateId: string) =>
    items.filter((item) => item.estimate_id === estimateId);

  const getEstimateTotal = (estimateId: string) =>
    getEstimateItems(estimateId).reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0
    );

  const exportPdf = async (estimate: Estimate) => {
    const estimateItems = getEstimateItems(estimate.id);
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
    doc.text(`Beneficiar: ${estimate.beneficiary || "-"}`, 14, 45);
    doc.text(`Santier: ${estimate.site_name || "-"}`, 14, 50);
    doc.text(`Data deviz: ${new Date(estimate.created_at).toLocaleDateString("ro-RO")}`, 14, 55);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 60);

    let total = 0;
    const rows = estimateItems.map((item, index) => {
      const service = serviceMap.get(item.service_id);
      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
      total += lineTotal;
      return [
        String(index + 1),
        service?.name || "-",
        service?.um || "-",
        String(item.quantity),
        `${Number(item.unit_price || 0).toFixed(2)} lei`,
        `${lineTotal.toFixed(2)} lei`,
      ];
    });

    autoTable(doc, {
      startY: 68,
      head: [["Nr.", "Serviciu", "UM", "Cantitate", "Pret unitar", "Total"]],
      body: rows,
      foot: [["", "", "", "", "TOTAL", `${total.toFixed(2)} lei`]],
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
    } catch {}

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);
    doc.save(`deviz_${estimate.site_name.replace(/\s+/g, "_")}_${estimate.id.slice(0, 8)}.pdf`);
  };

  const renderDevizIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-700 sm:h-7 sm:w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">
              {renderDevizIcon()}
            </div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-700" />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Se încarcă datele...</p>
              <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la dashboard
            </button>
            <button
              onClick={() => router.push("/devize/creeaza")}
              className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              + Adaugă deviz
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
              {renderDevizIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Devize lucrări</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Istoric devize
              </h1>
              <p className="mt-1 text-sm text-gray-500">{profile?.full_name}</p>
            </div>
          </div>

          {/* Sumar + search */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-green-700">{estimates.length}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-400">
                Total devize
              </p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">
                {estimates.reduce((s, e) => s + getEstimateTotal(e.id), 0).toFixed(0)} lei
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                Valoare totală
              </p>
            </div>
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută după beneficiar sau șantier..."
                className="h-full w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>
          </div>
        </section>

        {/* Lista devize */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Devize — {filteredEstimates.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredEstimates.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              {search ? (
                <p className="text-sm text-gray-500">Nu există devize pentru căutarea introdusă.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">
                    {renderDevizIcon()}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">Nu există devize încă</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Apasă pe „+ Adaugă deviz" pentru a crea primul deviz.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/devize/creeaza")}
                    className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
                  >
                    + Adaugă deviz
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEstimates.map((estimate) => {
                const estimateItems = getEstimateItems(estimate.id);
                const total = getEstimateTotal(estimate.id);

                return (
                  <div
                    key={estimate.id}
                    className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-green-50">
                            {renderDevizIcon()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold text-gray-900">{estimate.site_name}</p>
                            <p className="mt-0.5 text-sm text-gray-500">{estimate.beneficiary}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {new Date(estimate.created_at).toLocaleDateString("ro-RO", {
                                day: "2-digit", month: "long", year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="text-xl font-extrabold text-green-700">{total.toFixed(2)} lei</p>
                          <button
                            type="button"
                            onClick={() => exportPdf(estimate)}
                            className="rounded-xl bg-green-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800"
                          >
                            Export PDF
                          </button>
                        </div>
                      </div>

                      {/* Preview articole */}
                      {estimateItems.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-[#F8F7F3] p-3">
                          <div className="space-y-1.5">
                            {estimateItems.slice(0, 5).map((item) => {
                              const service = serviceMap.get(item.service_id);
                              const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                              return (
                                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="min-w-0 flex-1 truncate text-gray-700">
                                    {service?.name || "-"}
                                  </span>
                                  <span className="shrink-0 text-gray-500">
                                    {item.quantity} {service?.um || ""}
                                  </span>
                                  <span className="shrink-0 font-semibold text-gray-900">
                                    {lineTotal.toFixed(2)} lei
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {estimateItems.length > 5 && (
                            <p className="mt-2 text-xs font-semibold text-gray-400">
                              +{estimateItems.length - 5} articole suplimentare
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
