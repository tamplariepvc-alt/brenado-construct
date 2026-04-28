"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BottomNav from "@/components/BottomNav";

type FundingBaseRow = {
  id: string;
  project_id: string;
  added_by: string;
  team_lead_user_id: string;
  amount_ron: number | null;
  funding_type: "card" | "cont";
  funding_date: string;
  notes: string | null;
  created_at: string;
};

type FundingRow = FundingBaseRow & {
  project_name: string;
  project_beneficiary: string | null;
  team_lead_name: string;
  added_by_name: string;
};

type FundingRequest = {
  id: string;
  project_id: string;
  team_lead_user_id: string;
  amount_ron: number;
  notes: string | null;
  status: string;
  created_at: string;
  project_name?: string;
  team_lead_name?: string;
};

export default function AlimentariPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fundings, setFundings] = useState<FundingRow[]>([]);
  const [requests, setRequests] = useState<FundingRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"alimentari" | "solicitari">("alimentari");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const getFundingTypeLabel = (type: string) => {
    if (type === "card") return "Card";
    if (type === "cont") return "Cont";
    return type;
  };

  const getFundingTypeClasses = (type: string) => {
    if (type === "card") return "bg-green-100 text-green-700";
    if (type === "cont") return "bg-[#0196ff]/10 text-[#0196ff]";
    return "bg-gray-100 text-gray-700";
  };

  const loadData = async () => {
    setLoading(true);

    const { data: fundingData } = await supabase
      .from("project_fundings")
      .select("id, project_id, added_by, team_lead_user_id, amount_ron, funding_type, funding_date, notes, created_at")
      .order("funding_date", { ascending: false })
      .order("created_at", { ascending: false });

    const baseRows = (fundingData || []) as FundingBaseRow[];

    const { data: requestsData } = await supabase
      .from("funding_requests")
      .select("id, project_id, team_lead_user_id, amount_ron, notes, status, created_at")
      .order("created_at", { ascending: false });

    const reqRows = (requestsData || []) as FundingRequest[];

    const allProjectIds = Array.from(new Set([
      ...baseRows.map((r) => r.project_id),
      ...reqRows.map((r) => r.project_id),
    ].filter(Boolean)));

    const allProfileIds = Array.from(new Set([
      ...baseRows.flatMap((r) => [r.team_lead_user_id, r.added_by]),
      ...reqRows.map((r) => r.team_lead_user_id),
    ].filter(Boolean)));

    const [projectsRes, profilesRes] = await Promise.all([
      allProjectIds.length > 0
        ? supabase.from("projects").select("id, name, beneficiary").in("id", allProjectIds)
        : Promise.resolve({ data: [] }),
      allProfileIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", allProfileIds)
        : Promise.resolve({ data: [] }),
    ]);

    const projectMap = new Map((projectsRes.data || []).map((p: any) => [p.id, p]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

    setFundings(baseRows.map((row) => ({
      ...row,
      project_name: (projectMap.get(row.project_id) as any)?.name || "-",
      project_beneficiary: (projectMap.get(row.project_id) as any)?.beneficiary || "-",
      team_lead_name: (profileMap.get(row.team_lead_user_id) as any)?.full_name || "-",
      added_by_name: (profileMap.get(row.added_by) as any)?.full_name || "-",
    })));

    setRequests(reqRows.map((row) => ({
      ...row,
      project_name: (projectMap.get(row.project_id) as any)?.name || "-",
      team_lead_name: (profileMap.get(row.team_lead_user_id) as any)?.full_name || "-",
    })));

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredFundings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return fundings;
    return fundings.filter((f) => {
      const amount = Number(f.amount_ron || 0);
      return (
        f.project_name.toLowerCase().includes(q) ||
        (f.project_beneficiary || "").toLowerCase().includes(q) ||
        f.team_lead_name.toLowerCase().includes(q) ||
        f.added_by_name.toLowerCase().includes(q) ||
        getFundingTypeLabel(f.funding_type).toLowerCase().includes(q) ||
        amount.toFixed(2).includes(q)
      );
    });
  }, [fundings, searchTerm]);

  const totals = useMemo(() => ({
    count: filteredFundings.length,
    total: filteredFundings.reduce((s, f) => s + Number(f.amount_ron || 0), 0),
  }), [filteredFundings]);

  const cardTotal = useMemo(() =>
    filteredFundings.filter((f) => f.funding_type === "card").reduce((s, f) => s + Number(f.amount_ron || 0), 0),
    [filteredFundings]
  );

  const contTotal = useMemo(() =>
    filteredFundings.filter((f) => f.funding_type === "cont").reduce((s, f) => s + Number(f.amount_ron || 0), 0),
    [filteredFundings]
  );

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  const handleExportPdf = () => {
    if (filteredFundings.length === 0) { alert("Nu există date pentru export."); return; }

    const doc = new jsPDF("p", "mm", "a4");
    const now = new Date();

    doc.setFontSize(16);
    doc.text("Raport alimentari carduri / conturi", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generat la ${now.toLocaleString("ro-RO")}`, 14, 22);
    doc.text(`Total: ${totals.count}  |  Valoare totala: ${totals.total.toFixed(2)} lei`, 14, 27);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 32,
      head: [["Nr.", "Proiect", "Beneficiar", "Sef santier", "Alimentat de", "Tip", "Suma", "Data"]],
      body: filteredFundings.map((f, i) => [
        String(i + 1),
        f.project_name,
        f.project_beneficiary || "-",
        f.team_lead_name,
        f.added_by_name,
        getFundingTypeLabel(f.funding_type),
        `${Number(f.amount_ron || 0).toFixed(2)} lei`,
        f.funding_date ? new Date(f.funding_date).toLocaleDateString("ro-RO") : "-",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [1, 150, 255] },
      theme: "grid",
    });

    doc.save("raport_alimentari.pdf");
  };

  // ── Navigheaza direct la adauga, FARA sa marcheze approved ──────────────
  const handleApproveRequest = (req: FundingRequest) => {
    router.push(
      `/admin/alimentari/adauga?project_id=${req.project_id}&amount=${req.amount_ron}&lead_id=${req.team_lead_user_id}&notes=${encodeURIComponent(req.notes || "")}&from_request=${req.id}`
    );
  };

  const handleRejectRequest = async (reqId: string) => {
    setRejectingId(reqId);
    const { error } = await supabase
      .from("funding_requests")
      .update({ status: "rejected" })
      .eq("id", reqId);

    if (error) { alert(`Eroare: ${error.message}`); setRejectingId(null); return; }

    await loadData();
    setRejectingId(null);
  };

  const renderFundingIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderFundingIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
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
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la admin
            </button>
            <button
              onClick={() => router.push("/admin/alimentari/adauga")}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Alimentare
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderFundingIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Alimentări carduri & conturi
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Gestionează alimentările proiectelor și solicitările șefilor de echipă.
              </p>
            </div>
          </div>

          {/* Tab-uri */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("alimentari")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === "alimentari" ? "bg-[#0196ff] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Alimentări
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "alimentari" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {fundings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("solicitari")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === "solicitari" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
              }`}
            >
              Solicitări
              {pendingRequests.length > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "solicitari" ? "bg-white/20 text-white" : "bg-orange-200 text-orange-700"
                }`}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "alimentari" && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Caută după șantier, șef de echipă, tip sau valoare..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
              <button
                type="button"
                onClick={handleExportPdf}
                className="shrink-0 rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Export PDF
              </button>
            </div>
          )}
        </section>

        {/* ── TAB ALIMENTARI ── */}
        {activeTab === "alimentari" && (
          <>
            <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total alimentări</p>
                <p className="mt-1 text-2xl font-extrabold text-gray-900">{totals.count}</p>
              </div>
              <div className="rounded-[20px] bg-[#0196ff] p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Valoare totală</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{totals.total.toFixed(2)} lei</p>
              </div>
              <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total card</p>
                <p className="mt-1 text-2xl font-extrabold text-green-700">{cardTotal.toFixed(2)} lei</p>
              </div>
              <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total cont</p>
                <p className="mt-1 text-2xl font-extrabold text-[#0196ff]">{contTotal.toFixed(2)} lei</p>
              </div>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Lista alimentări — {filteredFundings.length} înregistrări
                </p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>

              {filteredFundings.length === 0 ? (
                <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                  <p className="text-sm text-gray-500">Nu există alimentări pentru criteriul introdus.</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                    <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                      <div className="col-span-3">Șantier</div>
                      <div className="col-span-2">Șef șantier</div>
                      <div className="col-span-2">Alimentat de</div>
                      <div className="col-span-1">Tip</div>
                      <div className="col-span-2">Sumă</div>
                      <div className="col-span-1">Data</div>
                      <div className="col-span-1"></div>
                    </div>
                    {filteredFundings.map((funding) => (
                      <button
                        key={funding.id}
                        onClick={() => router.push(`/admin/alimentari/${funding.id}`)}
                        className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                      >
                        <div className="col-span-3">
                          <p className="text-sm font-semibold text-gray-900">{funding.project_name}</p>
                          <p className="text-xs text-gray-400">{funding.project_beneficiary || "-"}</p>
                        </div>
                        <div className="col-span-2 text-sm text-gray-600">{funding.team_lead_name}</div>
                        <div className="col-span-2 text-sm text-gray-600">{funding.added_by_name}</div>
                        <div className="col-span-1">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getFundingTypeClasses(funding.funding_type)}`}>
                            {getFundingTypeLabel(funding.funding_type)}
                          </span>
                        </div>
                        <div className="col-span-2 text-sm font-bold text-gray-900">
                          {Number(funding.amount_ron || 0).toFixed(2)} lei
                        </div>
                        <div className="col-span-1 text-sm text-gray-500">
                          {funding.funding_date ? new Date(funding.funding_date).toLocaleDateString("ro-RO") : "-"}
                        </div>
                        <div className="col-span-1 text-right text-2xl font-light text-gray-400">›</div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 lg:hidden">
                    {filteredFundings.map((funding) => (
                      <button
                        key={funding.id}
                        onClick={() => router.push(`/admin/alimentari/${funding.id}`)}
                        className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                              {renderFundingIcon()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold leading-5 text-gray-900">{funding.project_name}</p>
                              <p className="mt-0.5 text-sm text-gray-500">{funding.project_beneficiary || "-"}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <p className="text-base font-bold text-gray-900">{Number(funding.amount_ron || 0).toFixed(2)} lei</p>
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getFundingTypeClasses(funding.funding_type)}`}>
                              {getFundingTypeLabel(funding.funding_type)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 pr-8">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Șef șantier</p>
                            <p className="mt-1 text-sm text-gray-700">{funding.team_lead_name}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data</p>
                            <p className="mt-1 text-sm text-gray-700">
                              {funding.funding_date ? new Date(funding.funding_date).toLocaleDateString("ro-RO") : "-"}
                            </p>
                          </div>
                        </div>
                        <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400">›</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ── TAB SOLICITARI ── */}
        {activeTab === "solicitari" && (
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Solicitări primite — {requests.length} total
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            {requests.length === 0 ? (
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Nu există solicitări de alimentare.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className={`rounded-[22px] border bg-white p-5 shadow-sm ${
                      req.status === "pending" ? "border-orange-200" : "border-[#E8E5DE]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900">{req.project_name}</p>
                        <p className="mt-0.5 text-sm text-gray-500">Solicitat de: {req.team_lead_name}</p>
                        {req.notes && (
                          <p className="mt-1 text-sm italic text-gray-400">"{req.notes}"</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(req.created_at).toLocaleDateString("ro-RO")} la{" "}
                          {new Date(req.created_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-xl font-extrabold text-gray-900">
                          {Number(req.amount_ron).toFixed(2)} lei
                        </p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          req.status === "pending" ? "bg-yellow-100 text-yellow-700"
                          : req.status === "approved" ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {req.status === "pending" ? "În așteptare"
                           : req.status === "approved" ? "Aprobată"
                           : "Respinsă"}
                        </span>
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req)}
                          className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          Aprobă & Alimentează
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req.id)}
                          disabled={rejectingId === req.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          {rejectingId === req.id ? "..." : "Respinge"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
	return (
  <div className="min-h-screen bg-[#F0EEE9]">
    {/* ... restul paginii ... */}
    <BottomNav />
  </div>
);
  );
}
