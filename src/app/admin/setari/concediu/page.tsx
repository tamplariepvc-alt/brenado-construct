"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Worker = {
  id: string;
  full_name: string;
  worker_type: string | null;
  is_active: boolean;
};

type WorkerLeave = {
  id: string;
  worker_id: string;
  year: number;
  days_total: number;
  days_taken: number;
};

type LeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  notes: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  user_name?: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function SetariConcediuPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerLeave, setWorkerLeave] = useState<WorkerLeave[]>([]);
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [leaveSearch, setLeaveSearch] = useState("");
  const [savingLeave, setSavingLeave] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<Record<string, { days_total: string; days_taken: string }>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [activeTab, setActiveTab] = useState<"concediu" | "solicitari">("concediu");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    const [workersRes, leaveRes] = await Promise.all([
      supabase.from("workers").select("id, full_name, worker_type, is_active")
        .eq("is_active", true).order("full_name", { ascending: true }),
      supabase.from("worker_leave").select("id, worker_id, year, days_total, days_taken")
        .eq("year", leaveYear),
    ]);

    const w = (workersRes.data as Worker[]) || [];
    const l = (leaveRes.data as WorkerLeave[]) || [];
    setWorkers(w);
    setWorkerLeave(l);

    const init: Record<string, { days_total: string; days_taken: string }> = {};
    w.forEach((worker) => {
      const existing = l.find((x) => x.worker_id === worker.id);
      init[worker.id] = {
        days_total: String(existing?.days_total ?? 21),
        days_taken: String(existing?.days_taken ?? 0),
      };
    });
    setEditingLeave(init);

    // Incarca solicitarile de concediu
    const reqRes = await supabase
      .from("leave_requests")
      .select("id, user_id, start_date, end_date, days_count, notes, status, created_at, approved_at")
      .order("created_at", { ascending: false });

    const reqs = (reqRes.data as LeaveRequest[]) || [];

    // Fetch nume utilizatori
    const userIds = [...new Set(reqs.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p.full_name]));
      setLeaveRequests(reqs.map((r) => ({ ...r, user_name: profileMap.get(r.user_id) || "-" })));
    } else {
      setLeaveRequests([]);
    }
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "administrator") { router.push("/dashboard"); return; }
      await loadData();
      setLoading(false);
    };
    checkAndLoad();
  }, [router]);

  useEffect(() => {
    if (!loading) loadData();
  }, [leaveYear]);

  const handleApproveRequest = async (requestId: string, userId: string, daysCount: number) => {
    setProcessingId(requestId);

    // Aproba cererea
    const { error: approveError } = await supabase.from("leave_requests").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: (await supabase.auth.getUser()).data.user?.id,
    }).eq("id", requestId);

    if (approveError) { showToast("error", `Eroare: ${approveError.message}`); setProcessingId(null); return; }

    // Actualizeaza days_taken in worker_leave
    const { data: leaveData } = await supabase.from("worker_leave")
      .select("id, days_taken").eq("user_id", userId).eq("year", new Date().getFullYear()).single();

    if (leaveData) {
      await supabase.from("worker_leave").update({
        days_taken: leaveData.days_taken + daysCount,
        updated_at: new Date().toISOString(),
      }).eq("id", leaveData.id);
    }

    setProcessingId(null);
    await loadData();
    showToast("success", "Cererea a fost aprobată și zilele au fost actualizate.");
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingId(requestId);
    const { error } = await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", requestId);
    if (error) { showToast("error", `Eroare: ${error.message}`); setProcessingId(null); return; }
    setProcessingId(null);
    await loadData();
    showToast("success", "Cererea a fost respinsă.");
  };

  const handleSaveLeave = async (workerId: string) => {
    const val = editingLeave[workerId];
    if (!val) return;

    const daysTotal = Number(val.days_total) || 0;
    const daysTaken = Number(val.days_taken) || 0;

    setSavingLeave(workerId);
    const existing = workerLeave.find((l) => l.worker_id === workerId && l.year === leaveYear);

    if (existing) {
      const { error } = await supabase.from("worker_leave").update({
        days_total: daysTotal, days_taken: daysTaken,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingLeave(null); return; }
    } else {
      const { error } = await supabase.from("worker_leave").insert({
        worker_id: workerId, year: leaveYear,
        days_total: daysTotal, days_taken: daysTaken,
      });
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingLeave(null); return; }
    }

    setSavingLeave(null);
    await loadData();
    showToast("success", "Concediu actualizat.");
  };

  const getWorkerTypeBadge = (type: string | null) => {
    if (type === "personal_executie") return { label: "Execuție", classes: "bg-blue-100 text-blue-700" };
    if (type === "tesa") return { label: "TESA", classes: "bg-purple-100 text-purple-700" };
    return { label: type || "-", classes: "bg-gray-100 text-gray-600" };
  };

  const filteredWorkers = workers.filter((w) =>
    !leaveSearch.trim() || w.full_name.toLowerCase().includes(leaveSearch.toLowerCase())
  );

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-700 sm:h-7 sm:w-7">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15h2M14 15h2M8 19h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">{renderIcon()}</div>
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
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${
            toast.type === "success" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"
          }`}>
            {toast.type === "success" ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-600" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/admin/setari")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la setări
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Setări · Personal</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Zile concediu</h1>
              <p className="mt-2 text-sm text-gray-500">
                Setează zilele anuale și zilele luate pentru fiecare angajat activ.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-[#F8F7F3] px-4 py-2.5">
              <label className="text-sm font-semibold text-gray-600">An:</label>
              <select value={leaveYear} onChange={(e) => setLeaveYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-gray-900 outline-none">
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <input type="text" placeholder="Caută angajat..."
              value={leaveSearch} onChange={(e) => setLeaveSearch(e.target.value)}
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3 text-center">
              <p className="text-xl font-extrabold text-gray-900">{workers.length}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Angajați activi</p>
            </div>
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-center">
              <p className="text-xl font-extrabold text-green-700">
                {workerLeave.reduce((s, l) => s + (l.days_total - l.days_taken), 0)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">Zile rămase total</p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
              <p className="text-xl font-extrabold text-orange-600">
                {workerLeave.reduce((s, l) => s + l.days_taken, 0)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-400">Zile luate total</p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setActiveTab("concediu")}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "concediu" ? "bg-[#0196ff] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            Zile concediu
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeTab === "concediu" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
              {workers.length}
            </span>
          </button>
          <button type="button" onClick={() => setActiveTab("solicitari")}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "solicitari" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            }`}>
            Solicitări
            {leaveRequests.filter(r => r.status === "pending").length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeTab === "solicitari" ? "bg-white/20 text-white" : "bg-orange-200 text-orange-700"}`}>
                {leaveRequests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "concediu" && (
        <section className="mt-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Angajați — {filteredWorkers.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredWorkers.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Nu există angajați activi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkers.map((worker) => {
                const val = editingLeave[worker.id] || { days_total: "21", days_taken: "0" };
                const daysTotal = Number(val.days_total) || 0;
                const daysTaken = Number(val.days_taken) || 0;
                const daysRemaining = daysTotal - daysTaken;
                const badge = getWorkerTypeBadge(worker.worker_type);
                const pct = daysTotal > 0 ? Math.min(100, (daysTaken / daysTotal) * 100) : 0;

                return (
                  <div key={worker.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">{worker.full_name}</p>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className={`shrink-0 rounded-2xl px-4 py-2 text-center ${
                        daysRemaining < 0 ? "bg-red-50" : daysRemaining === 0 ? "bg-gray-100" : "bg-green-50"
                      }`}>
                        <p className={`text-2xl font-extrabold ${
                          daysRemaining < 0 ? "text-red-600" : daysRemaining === 0 ? "text-gray-500" : "text-green-700"
                        }`}>
                          {daysRemaining}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-400">zile rămase</p>
                      </div>
                    </div>

                    {/* Bară progres */}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-400" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-gray-400">{daysTaken} din {daysTotal} zile folosite</p>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-600">Zile anuale totale</label>
                        <input
                          type="number" min="0" step="1"
                          value={val.days_total}
                          onChange={(e) => setEditingLeave((prev) => ({
                            ...prev, [worker.id]: { ...prev[worker.id], days_total: e.target.value }
                          }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#0196ff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-600">Zile luate</label>
                        <input
                          type="number" min="0" step="1"
                          value={val.days_taken}
                          onChange={(e) => setEditingLeave((prev) => ({
                            ...prev, [worker.id]: { ...prev[worker.id], days_taken: e.target.value }
                          }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#0196ff]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveLeave(worker.id)}
                      disabled={savingLeave === worker.id}
                      className="mt-3 w-full rounded-xl bg-[#0196ff] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      {savingLeave === worker.id ? "Se salvează..." : "Salvează"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {activeTab === "solicitari" && (
          <section className="mt-4 space-y-3">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Solicitări concediu — {leaveRequests.length} total
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            {leaveRequests.length === 0 ? (
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Nu există solicitări de concediu.</p>
              </div>
            ) : (
              leaveRequests.map((req) => (
                <div key={req.id} className={`rounded-[22px] border bg-white p-5 shadow-sm ${
                  req.status === "pending" ? "border-orange-200" : "border-[#E8E5DE]"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-gray-900">{req.user_name}</p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {new Date(req.start_date).toLocaleDateString("ro-RO")} → {new Date(req.end_date).toLocaleDateString("ro-RO")}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {req.days_count} zile lucrătoare · {new Date(req.created_at).toLocaleDateString("ro-RO")}
                      </p>
                      {req.notes && <p className="mt-1 text-xs italic text-gray-400">"{req.notes}"</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      req.status === "pending" ? "bg-yellow-100 text-yellow-700"
                      : req.status === "approved" ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                      {req.status === "pending" ? "În așteptare" : req.status === "approved" ? "Aprobată" : "Respinsă"}
                    </span>
                  </div>

                  {req.status === "pending" && (
                    <div className="mt-4 flex gap-3">
                      <button type="button"
                        onClick={() => handleApproveRequest(req.id, req.user_id, req.days_count)}
                        disabled={processingId === req.id}
                        className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                        {processingId === req.id ? "..." : "Aprobă"}
                      </button>
                      <button type="button"
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={processingId === req.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60">
                        {processingId === req.id ? "..." : "Respinge"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
