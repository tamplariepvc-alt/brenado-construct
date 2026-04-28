"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type TimeEntry = {
  id: string;
  worker_id: string;
  project_id: string;
  work_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  worker_name?: string;
  worker_type?: string;
  project_name?: string;
};

type ProjectOption = { id: string; name: string };
type WorkerOption = { id: string; full_name: string; worker_type: string };

type PeriodFilter = "azi" | "data" | "interval" | "luna" | "toate";
type CategoryFilter = "toate" | "executie" | "tesa";

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function IstoricPontajePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("azi");
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("toate");
  const [selectedProjectId, setSelectedProjectId] = useState("toate");
  const [workerSearch, setWorkerSearch] = useState("");

  const today = useMemo(() => getTodayDate(), []);

  const loadData = async () => {
    setLoading(true);

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });

    const { data: workersData } = await supabase
      .from("workers")
      .select("id, full_name, worker_type")
      .order("full_name", { ascending: true });

    const projectsList = (projectsData || []) as ProjectOption[];
    const workersList = (workersData || []) as WorkerOption[];

    setProjects(projectsList);
    setWorkers(workersList);

    // Fetch pontaje complete
    const { data: entriesData } = await supabase
      .from("time_entries")
      .select(`
        id,
        worker_id,
        project_id,
        work_date,
        start_time,
        end_time,
        status
      `)
      .not("end_time", "is", null)
      .order("work_date", { ascending: false })
      .order("start_time", { ascending: false });

    const workerMap = new Map(workersList.map((w) => [w.id, w]));
    const projectMap = new Map(projectsList.map((p) => [p.id, p.name]));

    const enriched = (entriesData || []).map((entry: any) => ({
      ...entry,
      worker_name: workerMap.get(entry.worker_id)?.full_name || "-",
      worker_type: workerMap.get(entry.worker_id)?.worker_type || "executie",
      project_name: projectMap.get(entry.project_id) || "-",
    })) as TimeEntry[];

    setEntries(enriched);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Calcul durata fara pauza 12-13
  const getWorkedMs = (startTime: string, endTime: string) => {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (endMs <= startMs) return 0;

    let total = endMs - startMs;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    while (cursor.getTime() <= last.getTime()) {
      const pauseStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0).getTime();
      const pauseEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 13, 0, 0).getTime();
      const start = Math.max(startMs, pauseStart);
      const end = Math.min(endMs, pauseEnd);
      if (end > start) total -= (end - start);
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(0, total);
  };

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Grupare pe worker+data
  type GroupedEntry = {
    key: string;
    worker_id: string;
    worker_name: string;
    worker_type: string;
    project_id: string;
    project_name: string;
    work_date: string;
    total_ms: number;
    first_start: string;
    last_end: string;
    entries_count: number;
  };

  const groupedEntries = useMemo<GroupedEntry[]>(() => {
    const map = new Map<string, GroupedEntry>();

    for (const entry of entries) {
      if (!entry.end_time) continue;
      const key = `${entry.work_date}__${entry.worker_id}__${entry.project_id}`;
      const ms = getWorkedMs(entry.start_time, entry.end_time);

      if (!map.has(key)) {
        map.set(key, {
          key,
          worker_id: entry.worker_id,
          worker_name: entry.worker_name || "-",
          worker_type: entry.worker_type || "executie",
          project_id: entry.project_id,
          project_name: entry.project_name || "-",
          work_date: entry.work_date,
          total_ms: ms,
          first_start: entry.start_time,
          last_end: entry.end_time,
          entries_count: 1,
        });
      } else {
        const g = map.get(key)!;
        g.total_ms += ms;
        g.entries_count += 1;
        if (new Date(entry.start_time) < new Date(g.first_start)) g.first_start = entry.start_time;
        if (new Date(entry.end_time!) > new Date(g.last_end)) g.last_end = entry.end_time!;
        map.set(key, g);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const d = new Date(b.work_date).getTime() - new Date(a.work_date).getTime();
      return d !== 0 ? d : a.worker_name.localeCompare(b.worker_name, "ro");
    });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return groupedEntries.filter((g) => {
      // Filtru perioada
      if (periodFilter === "azi" && g.work_date !== today) return false;
      if (periodFilter === "data" && g.work_date !== selectedDate) return false;
      if (periodFilter === "luna" && !g.work_date.startsWith(selectedMonth)) return false;
      if (periodFilter === "interval") {
        if (g.work_date < startDate || g.work_date > endDate) return false;
      }

      // Filtru categorie personal
      if (categoryFilter === "executie" && g.worker_type !== "executie") return false;
      if (categoryFilter === "tesa" && g.worker_type !== "tesa") return false;

      // Filtru santier
      if (selectedProjectId !== "toate" && g.project_id !== selectedProjectId) return false;

      // Cautare muncitor
      if (workerSearch.trim() && !g.worker_name.toLowerCase().includes(workerSearch.trim().toLowerCase())) return false;

      return true;
    });
  }, [groupedEntries, periodFilter, selectedDate, selectedMonth, startDate, endDate, categoryFilter, selectedProjectId, workerSearch, today]);

  const totals = useMemo(() => {
    const totalMs = filteredEntries.reduce((s, g) => s + g.total_ms, 0);
    const uniqueWorkers = new Set(filteredEntries.map((g) => g.worker_id)).size;
    const uniqueProjects = new Set(filteredEntries.map((g) => g.project_id)).size;
    return { totalMs, uniqueWorkers, uniqueProjects, records: filteredEntries.length };
  }, [filteredEntries]);

  const handleExportPdf = () => {
    if (filteredEntries.length === 0) { alert("Nu există date pentru export."); return; }

    const rows = filteredEntries.map((g, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${g.worker_name}</td>
        <td>${g.worker_type === "tesa" ? "TESA" : "Execuție"}</td>
        <td>${g.project_name}</td>
        <td>${new Date(g.work_date).toLocaleDateString("ro-RO")}</td>
        <td>${new Date(g.first_start).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${new Date(g.last_end).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</td>
        <td><strong>${formatMs(g.total_ms)}</strong></td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head>
          <title>Istoric Pontaje</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .sub { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
            .box-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
            .box-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f3f4f6; padding: 8px 10px; font-size: 11px; text-align: left; border: 1px solid #e5e7eb; }
            td { padding: 8px 10px; font-size: 12px; border: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Istoric Pontaje</h1>
          <div class="sub">Export generat la ${new Date().toLocaleString("ro-RO")}</div>
          <div class="summary">
            <div class="box"><div class="box-label">Înregistrări</div><div class="box-value">${totals.records}</div></div>
            <div class="box"><div class="box-label">Persoane</div><div class="box-value">${totals.uniqueWorkers}</div></div>
            <div class="box"><div class="box-label">Șantiere</div><div class="box-value">${totals.uniqueProjects}</div></div>
            <div class="box"><div class="box-label">Total ore</div><div class="box-value">${formatMs(totals.totalMs)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nr.</th><th>Nume</th><th>Categorie</th><th>Șantier</th>
                <th>Data</th><th>Intrare</th><th>Ieșire</th><th>Ore lucrate</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) { alert("Nu s-a putut deschide fereastra pentru export."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-indigo-600 sm:h-7 sm:w-7">
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50">
              {renderIcon()}
            </div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-indigo-600" />
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
      {/* Header */}
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
              onClick={handleExportPdf}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Export PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-indigo-50 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Istoric Pontaje
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Vizualizează pontajele pe șantiere, zile și categorie de personal.
              </p>
            </div>
          </div>

          {/* Filtre perioada */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { key: "azi", label: "Azi" },
              { key: "data", label: "Pe dată" },
              { key: "interval", label: "Interval" },
              { key: "luna", label: "Lunar" },
              { key: "toate", label: "Tot istoricul" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setPeriodFilter(f.key as PeriodFilter)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  periodFilter === f.key
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date pickers conditionali */}
          {periodFilter === "data" && (
            <div className="mt-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500 sm:w-64"
              />
            </div>
          )}
          {periodFilter === "luna" && (
            <div className="mt-4">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500 sm:w-64"
              />
            </div>
          )}
          {periodFilter === "interval" && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">De la</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Până la</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>
          )}

          {/* Filtre secundare */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Categorie personal */}
            <div className="flex gap-2">
              {[
                { key: "toate", label: "Toți" },
                { key: "executie", label: "Execuție" },
                { key: "tesa", label: "TESA" },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategoryFilter(c.key as CategoryFilter)}
                  className={`flex-1 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                    categoryFilter === c.key
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Santier */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500"
            >
              <option value="toate">Toate șantierele</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Cautare muncitor */}
            <input
              type="text"
              placeholder="Caută după nume..."
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
            />
          </div>
        </section>

        {/* Sumar totale */}
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[20px] bg-indigo-600 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Înregistrări</p>
            <p className="mt-1 text-2xl font-extrabold text-white">{totals.records}</p>
          </div>
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Persoane</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{totals.uniqueWorkers}</p>
          </div>
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Șantiere</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{totals.uniqueProjects}</p>
          </div>
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total ore</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{formatMs(totals.totalMs)}</p>
          </div>
        </section>

        {/* Lista pontaje */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Pontaje — {filteredEntries.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredEntries.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Nu există pontaje pentru filtrele selectate.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-3">Nume</div>
                  <div className="col-span-1">Categorie</div>
                  <div className="col-span-3">Șantier</div>
                  <div className="col-span-1">Data</div>
                  <div className="col-span-1">Intrare</div>
                  <div className="col-span-1">Ieșire</div>
                  <div className="col-span-2">Ore lucrate</div>
                </div>

                {filteredEntries.map((g) => (
                  <div
                    key={g.key}
                    className="grid grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-sm last:border-b-0"
                  >
                    <div className="col-span-3 font-semibold text-gray-900">{g.worker_name}</div>
                    <div className="col-span-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        g.worker_type === "tesa"
                          ? "bg-[#0196ff]/10 text-[#0196ff]"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {g.worker_type === "tesa" ? "TESA" : "Exec."}
                      </span>
                    </div>
                    <div className="col-span-3 text-gray-500 truncate">{g.project_name}</div>
                    <div className="col-span-1 text-gray-500">
                      {new Date(g.work_date).toLocaleDateString("ro-RO")}
                    </div>
                    <div className="col-span-1 text-gray-500">
                      {new Date(g.first_start).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="col-span-1 text-gray-500">
                      {new Date(g.last_end).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="col-span-2 font-bold text-gray-900">
                      {formatMs(g.total_ms)}
                      {g.entries_count > 1 && (
                        <span className="ml-2 text-xs font-normal text-gray-400">({g.entries_count} intrări)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {filteredEntries.map((g) => (
                  <div key={g.key} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-bold text-gray-900">{g.worker_name}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{g.project_name}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          g.worker_type === "tesa"
                            ? "bg-[#0196ff]/10 text-[#0196ff]"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {g.worker_type === "tesa" ? "TESA" : "Execuție"}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                          {new Date(g.work_date).toLocaleDateString("ro-RO")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-[#F8F7F3] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Intrare</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-700">
                          {new Date(g.first_start).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F7F3] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Ieșire</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-700">
                          {new Date(g.last_end).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-indigo-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Total ore</p>
                        <p className="mt-0.5 text-sm font-bold text-indigo-700">{formatMs(g.total_ms)}</p>
                      </div>
                    </div>

                    {g.entries_count > 1 && (
                      <p className="mt-2 text-xs text-gray-400">{g.entries_count} intrări înregistrate</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
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
