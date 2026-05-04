"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Worker = {
  id: string;
  full_name: string;
  extra_hour_rate: number | null;
  weekend_day_rate: number | null;
};

type Project = {
  id: string;
  name: string;
};

type ExtraWorkRow = {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  is_saturday: boolean | null;
  is_sunday: boolean | null;
  extra_hours_value: number | null;
  weekend_days_count: number | null;
  weekend_value: number | null;
  total_value: number | null;
  extra_hours_paid: boolean | null;
  weekend_paid: boolean | null;
  notes: string | null;
  created_at: string;
};

type EntryType = "extra" | "weekend";

type WorkerEntry = {
  worker_id: string;
  // ore extra
  extra_hours: string;
  // weekend
  worked: boolean;
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function OreExtraWeekendSefPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [history, setHistory] = useState<ExtraWorkRow[]>([]);
  const [workerMap, setWorkerMap] = useState<Map<string, Worker>>(new Map());

  // Form state
  const [entryType, setEntryType] = useState<EntryType>("extra");
  const [workDate, setWorkDate] = useState(getTodayDate());
  const [notes, setNotes] = useState("");
  const [workerEntries, setWorkerEntries] = useState<WorkerEntry[]>([]);

  // Istoric
  const [historyType, setHistoryType] = useState<EntryType>("extra");
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "sef_echipa") { router.push("/dashboard"); return; }

    // Gaseste worker-ul asociat userului
    const { data: workerData } = await supabase.from("workers").select("id").eq("user_id", user.id).maybeSingle();
    if (!workerData) { setLoading(false); return; }

    // Gaseste echipa din care face parte
    const { data: teamWorkerData } = await supabase
      .from("daily_team_workers").select("daily_team_id").eq("worker_id", workerData.id).maybeSingle();
    if (!teamWorkerData) { setLoading(false); return; }

    // Gaseste proiectul echipei
    const { data: teamData } = await supabase
      .from("daily_teams").select("id, project_id").eq("id", teamWorkerData.daily_team_id).single();
    if (!teamData) { setLoading(false); return; }

    const { data: projectData } = await supabase
      .from("projects").select("id, name").eq("id", teamData.project_id).single();
    if (projectData) setProject(projectData as Project);

    const projectId = teamData.project_id;

    // Toti muncitorii care au lucrat pe santier (din time_entries) + cei din echipa curenta
    const [{ data: teamWorkersData }, { data: timeEntryWorkersData }] = await Promise.all([
      supabase.from("daily_team_workers")
        .select("worker_id").eq("daily_team_id", teamData.id),
      supabase.from("time_entries")
        .select("worker_id").eq("project_id", projectId),
    ]);

    const allWorkerIds = Array.from(new Set([
      ...(teamWorkersData || []).map((w: any) => w.worker_id),
      ...(timeEntryWorkersData || []).map((w: any) => w.worker_id),
    ]));

    let workersPool: Worker[] = [];
    if (allWorkerIds.length > 0) {
      const { data: workersData } = await supabase
        .from("workers")
        .select("id, full_name, extra_hour_rate, weekend_day_rate")
        .in("id", allWorkerIds)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      workersPool = (workersData as Worker[]) || [];
    }

    setWorkers(workersPool);
    const wMap = new Map(workersPool.map((w) => [w.id, w]));
    setWorkerMap(wMap);

    // Initializeaza entries cu toti muncitorii neselectati
    setWorkerEntries(workersPool.map((w) => ({
      worker_id: w.id,
      extra_hours: "",
      worked: false,
    })));

    // Istoric ore extra/weekend pentru acest proiect
    const { data: historyData } = await supabase
      .from("extra_work")
      .select("id, project_id, worker_id, work_date, extra_hours, is_saturday, is_sunday, extra_hours_value, weekend_days_count, weekend_value, total_value, extra_hours_paid, weekend_paid, notes, created_at")
      .eq("project_id", projectId)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    setHistory((historyData as ExtraWorkRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Reset entries cand se schimba tipul
  useEffect(() => {
    setWorkerEntries((prev) => prev.map((e) => ({
      ...e,
      extra_hours: "",
      worked: false,
    })));
  }, [entryType]);

  const updateEntry = (workerId: string, field: keyof Omit<WorkerEntry, "worker_id">, value: any) => {
    setWorkerEntries((prev) => prev.map((e) =>
      e.worker_id === workerId ? { ...e, [field]: value } : e
    ));
  };

  // Calcul valori preview
  const previewTotals = useMemo(() => {
    let totalValue = 0;
    let workerCount = 0;

    workerEntries.forEach((entry) => {
      const worker = workerMap.get(entry.worker_id);
      if (!worker) return;

      if (entryType === "extra") {
        const hours = Number(entry.extra_hours || 0);
        if (hours <= 0) return;
        const rate = Number(worker.extra_hour_rate || 0);
        totalValue += hours * rate;
        workerCount++;
      } else {
        if (!entry.worked) return;
        const rate = Number(worker.weekend_day_rate || 0);
        totalValue += rate;
        workerCount++;
      }
    });

    return { totalValue, workerCount };
  }, [workerEntries, workerMap, entryType]);

  const handleSave = async () => {
    if (!project) return;

    // Filtreaza doar muncitorii cu valori introduse
    const validEntries = workerEntries.filter((entry) => {
      if (entryType === "extra") return Number(entry.extra_hours || 0) > 0;
      return entry.worked;
    });

    if (validEntries.length === 0) {
      alert("Selectează cel puțin un muncitor cu ore/zile completate.");
      return;
    }

    if (!workDate) { alert("Selectează data."); return; }

    setSaving(true);

    const rows = validEntries.map((entry) => {
      const worker = workerMap.get(entry.worker_id);
      const extraHourRate = Number(worker?.extra_hour_rate || 0);
      const weekendDayRate = Number(worker?.weekend_day_rate || 0);

      if (entryType === "extra") {
        const hours = Number(entry.extra_hours || 0);
        const value = hours * extraHourRate;
        return {
          project_id: project.id,
          worker_id: entry.worker_id,
          work_date: workDate,
          extra_hours: hours,
          extra_hours_value: value,
          is_saturday: false,
          is_sunday: false,
          weekend_days_count: 0,
          weekend_value: 0,
          total_value: value,
          extra_hours_paid: false,
          weekend_paid: false,
          notes: notes.trim() || null,
        };
      } else {
        const value = weekendDayRate;
        // Determinam sambata/duminica din data selectata
        const dayOfWeek = new Date(`${workDate}T00:00:00`).getDay();
        const isSat = dayOfWeek === 6;
        const isSun = dayOfWeek === 0;
        return {
          project_id: project.id,
          worker_id: entry.worker_id,
          work_date: workDate,
          extra_hours: 0,
          extra_hours_value: 0,
          is_saturday: isSat,
          is_sunday: isSun,
          weekend_days_count: 1,
          weekend_value: value,
          total_value: value,
          extra_hours_paid: false,
          weekend_paid: false,
          notes: notes.trim() || null,
        };
      }
    });

    const { error } = await supabase.from("extra_work").insert(rows);

    if (error) {
      alert(`Eroare la salvare: ${error.message}`);
      setSaving(false);
      return;
    }

    // Reset form
    setWorkerEntries((prev) => prev.map((e) => ({
      ...e, extra_hours: "", worked: false,
    })));
    setNotes("");
    setWorkDate(getTodayDate());
    setSaving(false);
    await loadData();
  };

  // Istoric filtrat
  const filteredHistory = useMemo(() => {
    return history.filter((row) => {
      if (historyType === "extra") return Number(row.extra_hours || 0) > 0;
      return Boolean(row.is_saturday) || Boolean(row.is_sunday) || Number(row.weekend_days_count || 0) > 0;
    });
  }, [history, historyType]);

  const visibleHistory = historyExpanded ? filteredHistory : filteredHistory.slice(0, 5);

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderIcon()}</div>
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
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">

        {/* Header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Șantier: <span className="font-semibold text-gray-700">{project?.name || "-"}</span></p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Ore extra & Weekend</h1>
              <p className="mt-2 text-sm text-gray-500">Adaugă ore suplimentare sau zile de weekend lucrate pentru echipa ta.</p>
            </div>
          </div>

          {/* Tip intrare */}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setEntryType("extra")}
              className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition ${entryType === "extra" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              ⏱ Ore extra
            </button>
            <button type="button" onClick={() => setEntryType("weekend")}
              className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition ${entryType === "weekend" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              📅 Zile weekend
            </button>
          </div>
        </section>

        {/* Formular adaugare */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {entryType === "extra" ? "Adaugă ore extra" : "Adaugă zile weekend"}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {/* Data */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Data</label>
            <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500 sm:max-w-xs" />
          </div>

          {/* Lista muncitori */}
          {workers.length === 0 ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <p className="text-sm text-yellow-800">Nu există muncitori asociați acestui șantier.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entryType === "extra" ? (
                // ORE EXTRA — input ore per muncitor
                workers.map((worker) => {
                  const entry = workerEntries.find((e) => e.worker_id === worker.id);
                  if (!entry) return null;
                  const hours = Number(entry.extra_hours || 0);
                  const rate = Number(worker.extra_hour_rate || 0);
                  const value = hours * rate;
                  const hasValue = hours > 0;

                  return (
                    <div key={worker.id}
                      className={`rounded-2xl border p-4 transition ${hasValue ? "border-purple-200 bg-purple-50/40" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{worker.full_name}</p>
                          <p className="text-xs text-gray-400">{rate > 0 ? `${rate.toFixed(2)} lei/oră` : "Rată nesetată"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {hasValue && (
                            <span className="text-sm font-bold text-purple-700">{value.toFixed(2)} lei</span>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.,]?[0-9]*"
                              value={entry.extra_hours}
                              onBlur={(e) => updateEntry(worker.id, "extra_hours", e.target.value)}
                              onChange={(e) => updateEntry(worker.id, "extra_hours", e.target.value)}
                              placeholder="0"
                              className={`w-20 rounded-xl border px-3 py-2 text-center text-sm font-semibold outline-none transition ${hasValue ? "border-purple-300 bg-white focus:border-purple-500" : "border-gray-200 focus:border-gray-500"}`}
                            />
                            <span className="text-xs text-gray-400">ore</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // WEEKEND — checkbox sambata/duminica per muncitor
                workers.map((worker) => {
                  const entry = workerEntries.find((e) => e.worker_id === worker.id);
                  if (!entry) return null;
                  const rate = Number(worker.weekend_day_rate || 0);
                  const hasValue = entry.worked;

                  return (
                    <label key={worker.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${hasValue ? "border-orange-200 bg-orange-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{worker.full_name}</p>
                        <p className="text-xs text-gray-400">{rate > 0 ? `${rate.toFixed(2)} lei/zi` : "Rată nesetată"}</p>
                        {hasValue && (
                          <p className="mt-1 text-sm font-bold text-orange-700">{rate.toFixed(2)} lei</p>
                        )}
                      </div>
                      <input type="checkbox" checked={entry.worked}
                        onChange={(e) => updateEntry(worker.id, "worked", e.target.checked)}
                        className="h-6 w-6 shrink-0 accent-orange-500" />
                    </label>
                  );
                })
              )}
            </div>
          )}

          {/* Observatii */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Observații (opțional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Ex: Urgență șantier, depășire program..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
          </div>

          {/* Preview total */}
          {previewTotals.workerCount > 0 && (
            <div className={`mt-4 rounded-2xl border p-4 ${entryType === "extra" ? "border-purple-200 bg-purple-50" : "border-orange-200 bg-orange-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${entryType === "extra" ? "text-purple-600" : "text-orange-600"}`}>
                    Total de salvat
                  </p>
                  <p className={`mt-1 text-sm text-gray-600`}>
                    {previewTotals.workerCount} {previewTotals.workerCount === 1 ? "muncitor" : "muncitori"}
                  </p>
                </div>
                <p className={`text-2xl font-extrabold ${entryType === "extra" ? "text-purple-700" : "text-orange-700"}`}>
                  {previewTotals.totalValue.toFixed(2)} lei
                </p>
              </div>
            </div>
          )}

          {/* Buton salvare */}
          <button type="button" onClick={handleSave} disabled={saving || previewTotals.workerCount === 0}
            className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 ${entryType === "extra" ? "bg-purple-600" : "bg-orange-500"}`}>
            {saving ? "Se salvează..." : `Salvează ${entryType === "extra" ? "ore extra" : "zile weekend"}`}
          </button>
        </section>

        {/* Istoric */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Istoric înregistrări</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
            {/* Tabs istoric */}
            <div className="flex gap-2 border-b border-[#E8E5DE] p-4">
              <button type="button" onClick={() => { setHistoryType("extra"); setHistoryExpanded(false); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${historyType === "extra" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                Ore extra
              </button>
              <button type="button" onClick={() => { setHistoryType("weekend"); setHistoryExpanded(false); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${historyType === "weekend" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                Weekend
              </button>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-sm text-gray-400">Nu există înregistrări {historyType === "extra" ? "de ore extra" : "de weekend"}.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DE]">
                {visibleHistory.map((row) => {
                  const worker = workerMap.get(row.worker_id);
                  const isPaid = historyType === "extra" ? Boolean(row.extra_hours_paid) : Boolean(row.weekend_paid);

                  return (
                    <div key={row.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {worker?.full_name || "-"}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {new Date(`${row.work_date}T00:00:00`).toLocaleDateString("ro-RO", {
                              weekday: "short", day: "numeric", month: "short", year: "numeric"
                            })}
                          </p>
                          {row.notes && (
                            <p className="mt-1 text-xs italic text-gray-500">{row.notes}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {isPaid ? "Achitat" : "Neachitat"}
                          </span>
                          {historyType === "extra" ? (
                            <span className="text-sm font-bold text-purple-700">
                              {Number(row.extra_hours || 0).toFixed(1)} h · {Number(row.extra_hours_value || 0).toFixed(2)} lei
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-orange-700">
                              {row.is_saturday && "Sâm"}{row.is_saturday && row.is_sunday && " + "}{row.is_sunday && "Dum"} · {Number(row.weekend_value || 0).toFixed(2)} lei
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredHistory.length > 5 && (
                  <div className="px-5 py-3">
                    <button type="button"
                      onClick={() => setHistoryExpanded((p) => !p)}
                      className="w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
                      {historyExpanded
                        ? "Arată mai puțin"
                        : `Arată mai mult (${filteredHistory.length - 5} înregistrări)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
