"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BottomNav from "@/components/BottomNav";

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

export default function DevizDetaliuPage() {
  const router = useRouter();
  const params = useParams();
  const estimateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("id, role").eq("id", user.id).single();
      if (!profileData) { router.push("/login"); return; }

      const { data: estimateData, error } = await supabase
        .from("estimates")
        .select("id, project_id, beneficiary, site_name, created_by, created_at")
        .eq("id", estimateId)
        .single();

      if (error || !estimateData) { router.push("/devize"); return; }

      // Verificare acces pentru sef_echipa
      if (profileData.role === "sef_echipa" && estimateData.created_by !== user.id) {
        router.push("/devize"); return;
      }

      const [itemsRes, servicesRes] = await Promise.all([
        supabase.from("estimate_items")
          .select("id, estimate_id, service_id, quantity, unit_price")
          .eq("estimate_id", estimateId)
          .order("id", { ascending: true }),
        supabase.from("services").select("id, name, um, price_ron"),
      ]);

      setEstimate(estimateData as Estimate);
      setItems((itemsRes.data as EstimateItem[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setLoading(false);
    };

    loadData();
  }, [estimateId, router]);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const total = useMemo(() =>
    items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
    [items]
  );

  const handleExportPdf = async () => {
    if (!estimate) return;
    setExporting(true);

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
    doc.text(`Beneficiar: ${estimate.beneficiary || "-"}`, 14, 45);
    doc.text(`Santier: ${estimate.site_name || "-"}`, 14, 50);
    doc.text(`Data deviz: ${new Date(estimate.created_at).toLocaleDateString("ro-RO")}`, 14, 55);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 60);

    let pdfTotal = 0;
    const rows = items.map((item, i) => {
      const svc = serviceMap.get(item.service_id);
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const lt = qty * price;
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
    doc.save(`deviz_${estimate.site_name.replace(/\s+/g, "_")}_${estimate.id.slice(0, 8)}.pdf`);

    setExporting(false);
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">{renderDevizIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-700" />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Se încarcă devizul...</p>
              <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/devize")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la devize
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Header deviz */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
                {renderDevizIcon()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Detaliu deviz</p>
                <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl break-words">
                  {estimate.site_name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">{estimate.beneficiary}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {new Date(estimate.created_at).toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-extrabold text-green-700">{total.toFixed(2)}</p>
              <p className="text-xs font-semibold text-green-600">lei</p>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                <path d="M12 16V4M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 20h16" strokeLinecap="round" />
              </svg>
              {exporting ? "Se generează PDF..." : "Export PDF"}
            </button>
          </div>
        </section>

        {/* Articole */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Articole deviz</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {items.length} {items.length === 1 ? "articol" : "articole"}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">Nu există articole în acest deviz.</p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-hidden lg:block">
                <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-1">Nr.</div>
                  <div className="col-span-6">Serviciu</div>
                  <div className="col-span-1">U.M.</div>
                  <div className="col-span-2">Cantitate</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {items.map((item, index) => {
                  const svc = serviceMap.get(item.service_id);
                  const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                  return (
                    <div key={item.id} className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0">
                      <div className="col-span-1 font-semibold text-gray-400">{index + 1}</div>
                      <div className="col-span-6 break-words font-medium text-gray-900">{svc?.name || "-"}</div>
                      <div className="col-span-1 text-gray-500">{svc?.um || "-"}</div>
                      <div className="col-span-2 text-gray-700">{Number(item.quantity).toFixed(2)}</div>
                      <div className="col-span-2 text-right font-bold text-green-700">{lineTotal.toFixed(2)} lei</div>
                    </div>
                  );
                })}
              </div>

              {/* Mobil — compact */}
              <div className="divide-y divide-[#F0EEE9] lg:hidden">
                {items.map((item, index) => {
                  const svc = serviceMap.get(item.service_id);
                  const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                          {index + 1}
                        </span>
                        <p className="break-words text-sm font-semibold text-gray-900 leading-snug">{svc?.name || "-"}</p>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between pl-7">
                        <span className="text-xs text-gray-500">
                          {Number(item.quantity).toFixed(2)} {svc?.um || ""} · {Number(item.unit_price).toFixed(2)} lei/{svc?.um || "buc"}
                        </span>
                        <span className="text-sm font-bold text-green-700">{lineTotal.toFixed(2)} lei</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between border-t border-[#E8E5DE] px-5 py-4">
            <p className="text-sm font-semibold text-gray-700">Total deviz</p>
            <p className="text-xl font-extrabold text-green-700">{total.toFixed(2)} lei</p>
          </div>
        </section>
      </main>
	  return (
  <div className="min-h-screen bg-[#F0EEE9]">
    {/* ... restul paginii ... */}
    <BottomNav />
  </div>
);
    </div>
  );
}
