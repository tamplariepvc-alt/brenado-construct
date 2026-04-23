"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
  extra_hour_rate?: number | null;
  weekend_day_rate?: number | null;
};

type WorkedWorker = {
  id: string;
  full_name: string;
  extra_hour_rate: number;
  weekend_day_rate: number;
  project_id: string;
  project_name: string;
  work_date: string;
};

type ExtraWorkRecord = {
  id: string;
  worker_id: string;
  project_id: string;
  work_date: string;
  extra_hours: number;
  extra_hours_value: number;
  extra_hours_paid: boolean;
  is_saturday: boolean;
  is_sunday: boolean;
  weekend_days_count: number;
  weekend_value: number;
  weekend_paid: boolean;
  total_value: number;
  worker_name?: string;
  project_name?: string;
};

type WeekendSelection = {
  saturday: boolean;
  sunday: boolean;
};

type Project = {
  id: string;
  name: string;
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

const getYesterdayDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

export default function OreExtraPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Muncitorii care au lucrat (din pontaje) — disponibili pentru ore extra
  const [workedWorkers, setWorkedWorkers] = useState<WorkedWorker[]>([]);
  // Toti muncitorii din santierele sefului (pentru weekend)
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  // Proiectele sefului
  const [projects, setProjects] = useState<Project[]>([]);
  // Proiect selectat pentru ore extra / weekend
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Ore extra modal
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraDate, setExtraDate] = useState(getTodayDate());
  const [extraHours, setExtraHours] = useState("");
  const [applyExtraToAll, setApplyExtraToAll] = useState(true);
  const [selectedExtraWorkers, setSelectedExtraWorkers] = useState<string[]>([]);
  const [savingExtra, setSavingExtra] = useState(false);
  // Muncitorii pontati pe data si proiectul selectat
  const [extraDateWorkers, setExtraDateWorkers] = useState<WorkedWorker[]>([]);
  const [loadingExtraWorkers, setLoadingExtraWorkers] = useState(false);

  // Weekend modal
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [weekendSelections, setWeekendSelections] = useState<Record<string, WeekendSelection>>({});
  const [savingWeekend, setSavingWeekend] = useState(false);
  const [weekendProjectWorkers, setWeekendProjectWorkers] = useState<Worker[]>([]);
  const [loadingWeekendWorkers, setLoadingWeekendWorkers] = useState(false);

  // Istoric ore extra
  const [historyRecords, setHistoryRecords] = useState<ExtraWorkRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"luna_curenta" | "luna_trecuta" | "data" | "tot">("luna_curenta");
  const [historyDate, setHistoryDate] = useState(getTodayDate());
  const [historyMonth, setHistoryMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [historyProjectFilter, setHistoryProjectFilter] = useState<string>("toate");

  const today = useMemo(() => getTodayDate(), []);

  // Calcul weekend trecut
  const getLastWeekendDates = () => {
    const current = new Date();
    const currentDay = current.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    const mondayThisWeek = new Date(current);
    mondayThisWeek.setDate(current.getDate() - daysSinceMonday);
    mondayThisWeek.setHours(0, 0, 0, 0);
    const lastSaturday = new Date(mondayThisWeek);
    lastSaturday.setDate(mondayThisWeek.getDate() - 2);
    const lastSunday = new Date(mondayThisWeek);
    lastSunday.setDate(mondayThisWeek.getDate() - 1);
    return { lastSaturday, lastSunday };
  };

  const { lastSaturday, lastSunday } = useMemo(() => getLastWeekendDates(), []);
  const saturdayDateString = lastSaturday.toISOString().split("T")[0];
  const sundayDateString = lastSunday.toISOString().split("T")[0];

  // ─── Load initial data ───────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) { router.push("/login"); return; }
      if (profileData.role !== "sef_echipa" && profileData.role !== "administrator") {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData as Profile);

      // Proiectele la care este sef
      const { data: linkedProjects } = await supabase
        .from("project_team_leads")
        .select("project_id")
        .eq("user_id", user.id);

      const projectIds = (linkedProjects || []).map((p) => p.project_id);

      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds)
        .order("name", { ascending: true });

      const projectsList = (projectsData || []) as Project[];
      setProjects(projectsList);

      if (projectsList.length > 0) {
        setSelectedProjectId(projectsList[0].id);
      }

      // Muncitorii care au pontaje (azi sau ieri) pe santierele sefului
      const { data: timeEntriesData } = await supabase
        .from("time_entries")
        .select(`
          worker_id,
          project_id,
          work_date,
          workers:worker_id (
            id,
            full_name,
            is_active,
            extra_hour_rate,
            weekend_day_rate
          )
        `)
        .in("project_id", projectIds)
        .in("work_date", [today, getYesterdayDate()])
        .not("end_time", "is", null);

      const workerMap = new Map<string, WorkedWorker>();
      (timeEntriesData || []).forEach((entry: any) => {
        const w = entry.workers?.[0];
        if (!w) return;
        const key = `${entry.worker_id}_${entry.project_id}_${entry.work_date}`;
        if (!workerMap.has(key)) {
          const proj = projectsList.find((p) => p.id === entry.project_id);
          workerMap.set(key, {
            id: entry.worker_id,
            full_name: w.full_name,
            extra_hour_rate: Number(w.extra_hour_rate || 0),
            weekend_day_rate: Number(w.weekend_day_rate || 0),
            project_id: entry.project_id,
            project_name: proj?.name || "-",
            work_date: entry.work_date,
          });
        }
      });
      setWorkedWorkers(Array.from(workerMap.values()));

      // Toti muncitorii activi din santierele sefului
      const { data: dailyTeamData } = await supabase
        .from("daily_teams")
        .select("id, project_id")
        .in("project_id", projectIds)
        .eq("work_date", today);

      const teamIds = (dailyTeamData || []).map((dt: any) => dt.id);
      let allWorkersPool: Worker[] = [];

      if (teamIds.length > 0) {
        const { data: dtWorkers } = await supabase
          .from("daily_team_workers")
          .select("worker_id")
          .in("daily_team_id", teamIds);

        const workerIds = Array.from(new Set((dtWorkers || []).map((dw: any) => dw.worker_id)));

        if (workerIds.length > 0) {
          const { data: workersData } = await supabase
            .from("workers")
            .select("id, full_name, is_active, extra_hour_rate, weekend_day_rate")
            .in("id", workerIds)
            .eq("is_active", true)
            .order("full_name", { ascending: true });

          allWorkersPool = (workersData || []) as Worker[];
        }
      }
      setAllWorkers(allWorkersPool);

      // Istoric ore extra
      await loadHistory(projectIds);

      setLoading(false);
    };

    loadData();
  }, [router, today]);

  const loadHistory = async (projectIds?: string[]) => {
    const ids = projectIds || projects.map((p) => p.id);
    if (ids.length === 0) return;

    const { data: extraData } = await supabase
      .from("extra_work")
      .select(`
        id,
        worker_id,
        project_id,
        work_date,
        extra_hours,
        extra_hours_value,
        extra_hours_paid,
        is_saturday,
        is_sunday,
        weekend_days_count,
        weekend_value,
        weekend_paid,
        total_value,
        workers:worker_id (
          id,
          full_name
        ),
        projects:project_id (
          id,
          name
        )
      `)
      .in("project_id", ids)
      .order("work_date", { ascending: false });

    const enriched = (extraData || []).map((row: any) => ({
      ...row,
      worker_name: row.workers?.[0]?.full_name || "-",
      project_name: row.projects?.[0]?.name || "-",
    })) as ExtraWorkRecord[];

    setHistoryRecords(enriched);
  };

  // ─── Load muncitori pontati pe data+proiect pentru modal ore extra ────────────
  const loadExtraDateWorkers = async (date: string, projectId: string) => {
    if (!projectId || !date) return;
    setLoadingExtraWorkers(true);

    const { data: entries } = await supabase
      .from("time_entries")
      .select(`
        worker_id,
        workers:worker_id (
          id,
          full_name,
          extra_hour_rate,
          weekend_day_rate
        )
      `)
      .eq("project_id", projectId)
      .eq("work_date", date)
      .not("end_time", "is", null);

    const map = new Map<string, WorkedWorker>();
    const proj = projects.find((p) => p.id === projectId);

    (entries || []).forEach((entry: any) => {
      const w = entry.workers?.[0];
      if (!w || map.has(entry.worker_id)) return;
      map.set(entry.worker_id, {
        id: entry.worker_id,
        full_name: w.full_name,
        extra_hour_rate: Number(w.extra_hour_rate || 0),
        weekend_day_rate: Number(w.weekend_day_rate || 0),
        project_id: projectId,
        project_name: proj?.name || "-",
        work_date: date,
      });
    });

    const workers = Array.from(map.values());
    setExtraDateWorkers(workers);
    setSelectedExtraWorkers(workers.map((w) => w.id));
    setLoadingExtraWorkers(false);
  };

  // ─── Load muncitori pentru weekend pe proiect ────────────────────────────────
  const loadWeekendProjectWorkers = async (projectId: string) => {
    if (!projectId) return;
    setLoadingWeekendWorkers(true);

    // Cauta muncitorii din daily_teams de azi SAU din pontajele recente
    const { data: recentEntries } = await supabase
      .from("time_entries")
      .select(`
        worker_id,
        workers:worker_id (
          id,
          full_name,
          is_active,
          extra_hour_rate,
          weekend_day_rate
        )
      `)
      .eq("project_id", projectId)
      .gte("work_date", (() => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        return d.toISOString().split("T")[0];
      })());

    const map = new Map<string, Worker>();
    (recentEntries || []).forEach((entry: any) => {
      const w = entry.workers?.[0];
      if (!w || map.has(entry.worker_id)) return;
      map.set(entry.worker_id, {
        id: entry.worker_id,
        full_name: w.full_name,
        is_active: true,
        extra_hour_rate: Number(w.extra_hour_rate || 0),
        weekend_day_rate: Number(w.weekend_day_rate || 0),
      });
    });

    const workersList = Array.from(map.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "ro")
    );

    setWeekendProjectWorkers(workersList);

    const initialSelections: Record<string, WeekendSelection> = {};
    workersList.forEach((w) => {
      initialSelections[w.id] = { saturday: false, sunday: false };
    });
    setWeekendSelections(initialSelections);
    setLoadingWeekendWorkers(false);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenExtraModal = () => {
    setExtraDate(today);
    setExtraHours("");
    setApplyExtraToAll(true);
    setExtraDateWorkers([]);
    setSelectedExtraWorkers([]);
    setShowExtraModal(true);
    loadExtraDateWorkers(today, selectedProjectId);
  };

  const handleOpenWeekendModal = () => {
    setShowWeekendModal(true);
    loadWeekendProjectWorkers(selectedProjectId);
  };

  const handleExtraDateChange = (date: string) => {
    setExtraDate(date);
    loadExtraDateWorkers(date, selectedProjectId);
  };

  const handleExtraProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (showExtraModal) loadExtraDateWorkers(extraDate, projectId);
    if (showWeekendModal) loadWeekendProjectWorkers(projectId);
  };

  const toggleExtraWorker = (workerId: string) => {
    setSelectedExtraWorkers((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const updateWeekendSelection = (workerId: string, day: "saturday" | "sunday", checked: boolean) => {
    setWeekendSelections((prev) => ({
      ...prev,
      [workerId]: {
        saturday: prev[workerId]?.saturday || false,
        sunday: prev[workerId]?.sunday || false,
        [day]: checked,
      },
    }));
  };

  const handleSaveExtraWork = async () => {
    const parsedHours = Number(extraHours || 0);
    if (parsedHours <= 0) { alert("Introdu un număr valid de ore extra."); return; }

    const targetWorkers = applyExtraToAll
      ? extraDateWorkers
      : extraDateWorkers.filter((w) => selectedExtraWorkers.includes(w.id));

    if (targetWorkers.length === 0) { alert("Nu există muncitori pentru salvare."); return; }

    setSavingExtra(true);

    const workerIds = targetWorkers.map((w) => w.id);

    const { data: existingRows } = await supabase
      .from("extra_work")
      .select("id, worker_id, weekend_days_count, weekend_value, weekend_paid, is_saturday, is_sunday")
      .eq("project_id", selectedProjectId)
      .eq("work_date", extraDate)
      .in("worker_id", workerIds);

    const existingMap = new Map((existingRows || []).map((r: any) => [r.worker_id, r]));

    const rows = targetWorkers.map((worker) => {
      const existing = existingMap.get(worker.id);
      const extraValue = parsedHours * worker.extra_hour_rate;
      return {
        project_id: selectedProjectId,
        worker_id: worker.id,
        work_date: extraDate,
        extra_hours: parsedHours,
        extra_hours_paid: false,
        extra_hours_value: extraValue,
        is_saturday: existing?.is_saturday || false,
        is_sunday: existing?.is_sunday || false,
        weekend_paid: existing?.weekend_paid || false,
        weekend_days_count: existing?.weekend_days_count || 0,
        weekend_value: existing?.weekend_value || 0,
        total_value: extraValue + Number(existing?.weekend_value || 0),
      };
    });

    const { error } = await supabase.from("extra_work").upsert(rows, {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    setSavingExtra(false);

    if (error) { alert(`Eroare salvare: ${error.message}`); return; }

    setShowExtraModal(false);
    await loadHistory();
    alert("Orele extra au fost salvate cu succes.");
  };

  const handleSaveWeekendWork = async () => {
    const satWorkers = weekendProjectWorkers.filter((w) => weekendSelections[w.id]?.saturday);
    const sunWorkers = weekendProjectWorkers.filter((w) => weekendSelections[w.id]?.sunday);

    if (satWorkers.length === 0 && sunWorkers.length === 0) {
      alert("Bifează cel puțin o zi pentru cel puțin un muncitor.");
      return;
    }

    setSavingWeekend(true);

    const allIds = Array.from(new Set([...satWorkers.map((w) => w.id), ...sunWorkers.map((w) => w.id)]));

    const { data: satExisting } = await supabase
      .from("extra_work")
      .select("worker_id, extra_hours, extra_hours_paid, extra_hours_value")
      .eq("project_id", selectedProjectId)
      .eq("work_date", saturdayDateString)
      .in("worker_id", allIds.length ? allIds : [""]);

    const { data: sunExisting } = await supabase
      .from("extra_work")
      .select("worker_id, extra_hours, extra_hours_paid, extra_hours_value")
      .eq("project_id", selectedProjectId)
      .eq("work_date", sundayDateString)
      .in("worker_id", allIds.length ? allIds : [""]);

    const satMap = new Map((satExisting || []).map((r: any) => [r.worker_id, r]));
    const sunMap = new Map((sunExisting || []).map((r: any) => [r.worker_id, r]));

    const satRows = satWorkers.map((w) => {
      const ex = satMap.get(w.id);
      const wkVal = Number(w.weekend_day_rate || 0);
      return {
        project_id: selectedProjectId,
        worker_id: w.id,
        work_date: saturdayDateString,
        extra_hours: ex?.extra_hours || 0,
        extra_hours_paid: ex?.extra_hours_paid || false,
        extra_hours_value: ex?.extra_hours_value || 0,
        is_saturday: true,
        is_sunday: false,
        weekend_paid: false,
        weekend_days_count: 1,
        weekend_value: wkVal,
        total_value: Number(ex?.extra_hours_value || 0) + wkVal,
      };
    });

    const sunRows = sunWorkers.map((w) => {
      const ex = sunMap.get(w.id);
      const wkVal = Number(w.weekend_day_rate || 0);
      return {
        project_id: selectedProjectId,
        worker_id: w.id,
        work_date: sundayDateString,
        extra_hours: ex?.extra_hours || 0,
        extra_hours_paid: ex?.extra_hours_paid || false,
        extra_hours_value: ex?.extra_hours_value || 0,
        is_saturday: false,
        is_sunday: true,
        weekend_paid: false,
        weekend_days_count: 1,
        weekend_value: wkVal,
        total_value: Number(ex?.extra_hours_value || 0) + wkVal,
      };
    });

    const { error } = await supabase.from("extra_work").upsert([...satRows, ...sunRows], {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    setSavingWeekend(false);
    if (error) { alert(`Eroare salvare weekend: ${error.message}`); return; }

    setShowWeekendModal(false);
    await loadHistory();
    alert("Zilele de weekend au fost salvate cu succes.");
  };

  // ─── Derivate pentru UI ───────────────────────────────────────────────────────
  const selectedExtraWorkersDetails = useMemo(() => {
    return applyExtraToAll
      ? extraDateWorkers
      : extraDateWorkers.filter((w) => selectedExtraWorkers.includes(w.id));
  }, [applyExtraToAll, selectedExtraWorkers, extraDateWorkers]);

  const extraPreview = useMemo(() => {
    const hours = Number(extraHours || 0);
    const total = selectedExtraWorkersDetails.reduce(
      (sum, w) => sum + hours * w.extra_hour_rate, 0
    );
    return { total };
  }, [extraHours, selectedExtraWorkersDetails]);

  const weekendPreview = useMemo(() => {
    let satCount = 0, sunCount = 0, totalValue = 0;
    weekendProjectWorkers.forEach((w) => {
      const sel = weekendSelections[w.id];
      if (sel?.saturday) { satCount++; totalValue += Number(w.weekend_day_rate || 0); }
      if (sel?.sunday) { sunCount++; totalValue += Number(w.weekend_day_rate || 0); }
    });
    return { satCount, sunCount, totalDays: satCount + sunCount, totalValue };
  }, [weekendProjectWorkers, weekendSelections]);

  const filteredHistory = useMemo(() => {
    let result = historyRecords;

    if (historyProjectFilter !== "toate") {
      result = result.filter((r) => r.project_id === historyProjectFilter);
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

    if (historyFilter === "luna_curenta") {
      result = result.filter((r) => r.work_date.startsWith(currentMonth));
    } else if (historyFilter === "luna_trecuta") {
      result = result.filter((r) => r.work_date.startsWith(lastMonth));
    } else if (historyFilter === "data") {
      result = result.filter((r) => r.work_date === historyDate);
    }

    return result;
  }, [historyRecords, historyFilter, historyDate, historyProjectFilter]);

  const historyTotals = useMemo(() => {
    const totalExtraHours = filteredHistory.reduce((s, r) => s + Number(r.extra_hours || 0), 0);
    const totalExtraValue = filteredHistory.reduce((s, r) => s + Number(r.extra_hours_value || 0), 0);
    const totalWeekendDays = filteredHistory.reduce((s, r) => s + Number(r.weekend_days_count || 0), 0);
    const totalWeekendValue = filteredHistory.reduce((s, r) => s + Number(r.weekend_value || 0), 0);
    const totalValue = filteredHistory.reduce((s, r) => s + Number(r.total_value || 0), 0);
    return { totalExtraHours, totalExtraValue, totalWeekendDays, totalWeekendValue, totalValue };
  }, [filteredHistory]);

  const renderPontajIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const renderClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-purple-600 sm:h-7 sm:w-7">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const renderCalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-orange-500 sm:h-7 sm:w-7">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Se încarcă datele...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-purple-50 sm:h-14 sm:w-14">
              {renderClockIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Management ore</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Ore extra & Weekend
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Adaugă ore suplimentare și zile de weekend lucrate pentru echipa ta. Datele sunt legate de pontajele existente.
              </p>
              <p className="mt-2 text-sm font-medium text-gray-400">
                {profile?.full_name} • {new Date(today).toLocaleDateString("ro-RO")}
              </p>
            </div>
          </div>
        </section>

        {projects.length === 0 ? (
          <div className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Nu ești asociat niciunui șantier activ.</p>
          </div>
        ) : (
          <>
            {/* Selector santier */}
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Șantier activ</p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Selectează șantierul pentru operații
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleExtraProjectChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-gray-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* Actiuni rapide */}
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Acțiuni rapide</p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Card ore extra */}
                <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-purple-50">
                      {renderClockIcon()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-gray-900">Ore extra</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Adaugă ore suplimentare muncitorilor pontați pe o anumită dată.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenExtraModal}
                    className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Adaugă ore extra
                  </button>
                </div>

                {/* Card weekend */}
                <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-orange-50">
                      {renderCalendarIcon()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-gray-900">Zile weekend</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Marchează prezența pentru weekendul trecut:{" "}
                        <span className="font-medium text-gray-700">
                          {lastSaturday.toLocaleDateString("ro-RO")} – {lastSunday.toLocaleDateString("ro-RO")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenWeekendModal}
                    className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Marchează weekend
                  </button>
                </div>
              </div>
            </section>

            {/* Istoric */}
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Istoric ore extra & weekend</p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>

              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
                {/* Filtre */}
                <div className="mb-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "luna_curenta", label: "Luna curentă" },
                      { key: "luna_trecuta", label: "Luna trecută" },
                      { key: "data", label: "Pe dată" },
                      { key: "tot", label: "Tot istoricul" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setHistoryFilter(f.key as any)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          historyFilter === f.key
                            ? "bg-[#0196ff] text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {historyFilter === "data" && (
                    <input
                      type="date"
                      value={historyDate}
                      onChange={(e) => setHistoryDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500 sm:w-64"
                    />
                  )}

                  {/* Filtru proiect */}
                  {projects.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryProjectFilter("toate")}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          historyProjectFilter === "toate"
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Toate șantierele
                      </button>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setHistoryProjectFilter(p.id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                            historyProjectFilter === p.id
                              ? "bg-gray-800 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sumar totale */}
                {filteredHistory.length > 0 && (
                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-purple-50 px-4 py-3">
                      <p className="text-xs font-medium text-purple-600">Ore extra</p>
                      <p className="mt-1 text-lg font-bold text-purple-800">{historyTotals.totalExtraHours.toFixed(1)} h</p>
                    </div>
                    <div className="rounded-2xl bg-purple-50 px-4 py-3">
                      <p className="text-xs font-medium text-purple-600">Valoare ore extra</p>
                      <p className="mt-1 text-lg font-bold text-purple-800">{historyTotals.totalExtraValue.toFixed(2)} lei</p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-4 py-3">
                      <p className="text-xs font-medium text-orange-600">Zile weekend</p>
                      <p className="mt-1 text-lg font-bold text-orange-700">{historyTotals.totalWeekendDays} zile</p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-4 py-3">
                      <p className="text-xs font-medium text-orange-600">Valoare weekend</p>
                      <p className="mt-1 text-lg font-bold text-orange-700">{historyTotals.totalWeekendValue.toFixed(2)} lei</p>
                    </div>
                  </div>
                )}

                {/* Lista istoric */}
                {filteredHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">Nu există înregistrări pentru filtrul selectat.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{record.worker_name}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{record.project_name}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                            {new Date(record.work_date).toLocaleDateString("ro-RO")}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {Number(record.extra_hours) > 0 && (
                            <>
                              <div className="rounded-xl bg-purple-50 px-3 py-2">
                                <p className="text-[11px] font-medium text-purple-600">Ore extra</p>
                                <p className="mt-0.5 text-sm font-bold text-purple-800">{record.extra_hours} h</p>
                              </div>
                              <div className="rounded-xl bg-purple-50 px-3 py-2">
                                <p className="text-[11px] font-medium text-purple-600">Valoare</p>
                                <p className="mt-0.5 text-sm font-bold text-purple-800">{Number(record.extra_hours_value).toFixed(2)} lei</p>
                              </div>
                            </>
                          )}

                          {(record.is_saturday || record.is_sunday) && (
                            <>
                              <div className="rounded-xl bg-orange-50 px-3 py-2">
                                <p className="text-[11px] font-medium text-orange-600">Zi weekend</p>
                                <p className="mt-0.5 text-sm font-bold text-orange-700">
                                  {record.is_saturday ? "Sâmbătă" : "Duminică"}
                                </p>
                              </div>
                              <div className="rounded-xl bg-orange-50 px-3 py-2">
                                <p className="text-[11px] font-medium text-orange-600">Valoare</p>
                                <p className="mt-0.5 text-sm font-bold text-orange-700">{Number(record.weekend_value).toFixed(2)} lei</p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-2">
                            {record.extra_hours_paid && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Ore extra plătite</span>
                            )}
                            {record.weekend_paid && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Weekend plătit</span>
                            )}
                            {!record.extra_hours_paid && Number(record.extra_hours) > 0 && (
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">Ore extra neplatite</span>
                            )}
                            {!record.weekend_paid && (record.is_saturday || record.is_sunday) && (
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">Weekend neplătit</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-gray-900">
                            Total: {Number(record.total_value).toFixed(2)} lei
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ── Modal ore extra ─────────────────────────────────────────────────────── */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Adaugă ore extra</h2>
                <p className="text-sm text-gray-500">Selectează data și muncitorii pontați în acea zi.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowExtraModal(false)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {/* Santier */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Șantier</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      loadExtraDateWorkers(extraDate, e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-gray-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Data pontajului</label>
                  <input
                    type="date"
                    value={extraDate}
                    max={today}
                    onChange={(e) => handleExtraDateChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                {/* Muncitori pontati pe data respectiva */}
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-700">
                    Muncitori pontați pe {new Date(extraDate).toLocaleDateString("ro-RO")}
                  </p>

                  {loadingExtraWorkers ? (
                    <p className="text-sm text-gray-500">Se încarcă muncitorii...</p>
                  ) : extraDateWorkers.length === 0 ? (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                      <p className="text-sm font-medium text-yellow-800">
                        Nu există muncitori pontați pe această dată pentru șantierul selectat.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={applyExtraToAll}
                            onChange={(e) => setApplyExtraToAll(e.target.checked)}
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-medium text-gray-800">
                            Aplică pentru toți ({extraDateWorkers.length} muncitori)
                          </span>
                        </label>
                      </div>

                      {!applyExtraToAll && (
                        <div className="space-y-2">
                          {extraDateWorkers.map((worker) => (
                            <label
                              key={worker.id}
                              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={selectedExtraWorkers.includes(worker.id)}
                                onChange={() => toggleExtraWorker(worker.id)}
                                className="h-5 w-5"
                              />
                              <span className="flex-1 text-sm font-medium text-gray-800">{worker.full_name}</span>
                              <span className="text-xs text-gray-500">{worker.extra_hour_rate} lei/h</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Ore extra */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Număr de ore extra</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={extraHours}
                    onChange={(e) => setExtraHours(e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                {/* Preview */}
                {selectedExtraWorkersDetails.length > 0 && Number(extraHours) > 0 && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                    <p className="text-sm font-medium text-purple-800">
                      {selectedExtraWorkersDetails.length} muncitori × {extraHours} ore extra
                    </p>
                    <p className="mt-1 text-base font-bold text-purple-900">
                      Total: {extraPreview.total.toFixed(2)} lei
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveExtraWork}
                    disabled={savingExtra || extraDateWorkers.length === 0 || Number(extraHours) <= 0}
                    className="w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {savingExtra ? "Se salvează..." : "Salvează ore extra"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExtraModal(false)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Renunță
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal weekend ────────────────────────────────────────────────────────── */}
      {showWeekendModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Zile lucrate în weekend</h2>
                <p className="text-sm text-gray-500">Marchează prezența pentru weekendul trecut.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeekendModal(false)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {/* Santier */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Șantier</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      loadWeekendProjectWorkers(e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-gray-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Info weekend */}
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <p className="text-sm font-medium text-orange-800">Weekend selectat</p>
                  <p className="mt-1 text-sm text-orange-900">
                    Sâmbătă: <span className="font-semibold">{lastSaturday.toLocaleDateString("ro-RO")}</span>
                    {" "}·{" "}
                    Duminică: <span className="font-semibold">{lastSunday.toLocaleDateString("ro-RO")}</span>
                  </p>
                </div>

                {/* Tabel muncitori */}
                {loadingWeekendWorkers ? (
                  <p className="text-sm text-gray-500">Se încarcă muncitorii...</p>
                ) : weekendProjectWorkers.length === 0 ? (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <p className="text-sm font-medium text-yellow-800">
                      Nu există muncitori cu pontaje recente pe acest șantier.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="grid grid-cols-[2fr_1fr_1fr] bg-[#F8F7F3] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      <div>Nume</div>
                      <div className="text-center">
                        Sâmbătă
                        <div className="mt-0.5 text-[10px] font-medium text-gray-400 normal-case tracking-normal">
                          {lastSaturday.toLocaleDateString("ro-RO")}
                        </div>
                      </div>
                      <div className="text-center">
                        Duminică
                        <div className="mt-0.5 text-[10px] font-medium text-gray-400 normal-case tracking-normal">
                          {lastSunday.toLocaleDateString("ro-RO")}
                        </div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {weekendProjectWorkers.map((worker) => (
                        <div
                          key={worker.id}
                          className="grid grid-cols-[2fr_1fr_1fr] items-center px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{worker.full_name}</p>
                            <p className="text-xs text-gray-400">{Number(worker.weekend_day_rate || 0)} lei/zi</p>
                          </div>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(weekendSelections[worker.id]?.saturday)}
                              onChange={(e) => updateWeekendSelection(worker.id, "saturday", e.target.checked)}
                              className="h-5 w-5"
                            />
                          </div>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(weekendSelections[worker.id]?.sunday)}
                              onChange={(e) => updateWeekendSelection(worker.id, "sunday", e.target.checked)}
                              className="h-5 w-5"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                {weekendPreview.totalDays > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-800">
                          {weekendPreview.satCount > 0 && `${weekendPreview.satCount} sâmbete`}
                          {weekendPreview.satCount > 0 && weekendPreview.sunCount > 0 && " · "}
                          {weekendPreview.sunCount > 0 && `${weekendPreview.sunCount} duminici`}
                        </p>
                        <p className="mt-0.5 text-xs text-orange-700">
                          {weekendPreview.totalDays} zile marcate total
                        </p>
                      </div>
                      <p className="text-base font-bold text-orange-900">
                        {weekendPreview.totalValue.toFixed(2)} lei
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveWeekendWork}
                    disabled={savingWeekend || weekendPreview.totalDays === 0}
                    className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {savingWeekend ? "Se salvează..." : "Salvează weekend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWeekendModal(false)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Renunță
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
