"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
  extra_hour_rate?: number | null;
  weekend_day_rate?: number | null;
};

type ActiveTimeEntry = {
  id: string;
  worker_id: string;
  start_time: string;
  status: string;
  worker_name?: string;
  workers?: {
    id: string;
    full_name: string;
  }[] | null;
};

type HistoryTimeEntry = {
  id: string;
  worker_id: string;
  start_time: string;
  end_time: string | null;
  work_date: string;
  status: string;
  worker_name?: string;
  workers?: {
    id: string;
    full_name: string;
  }[] | null;
};

type DailyHistoryGroup = {
  key: string;
  worker_id: string;
  worker_name: string;
  work_date: string;
  first_start: string;
  last_end: string;
  total_ms: number;
};

type TodayWorkedWorker = {
  id: string;
  full_name: string;
  extra_hour_rate: number;
  weekend_day_rate: number;
};

type WeekendSelection = {
  saturday: boolean;
  sunday: boolean;
};

type DailyTeam = {
  id: string;
  project_id: string;
  work_date: string;
};

type DailyTeamWorker = {
  daily_team_id: string;
  worker_id: string;
};

export default function PontajSantierPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [showWorkersList, setShowWorkersList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [activeEntries, setActiveEntries] = useState<ActiveTimeEntry[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryTimeEntry[]>([]);
  const [todayWorkedWorkers, setTodayWorkedWorkers] = useState<
    TodayWorkedWorker[]
  >([]);
  const [now, setNow] = useState(Date.now());

  const [sameTeamAsYesterday, setSameTeamAsYesterday] = useState(false);
  const [yesterdayWorkerIds, setYesterdayWorkerIds] = useState<string[]>([]);

  const [plannedTeamExists, setPlannedTeamExists] = useState(false);
  const [plannedTeamId, setPlannedTeamId] = useState<string | null>(null);
  const [plannedWorkerIds, setPlannedWorkerIds] = useState<string[]>([]);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<
    "azi" | "lunar" | "data" | "proiect"
  >("azi");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
      2,
      "0"
    )}`
  );

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraHours, setExtraHours] = useState("");
  const [applyExtraToAll, setApplyExtraToAll] = useState(true);
  const [selectedExtraWorkers, setSelectedExtraWorkers] = useState<string[]>(
    []
  );
  const [savingExtra, setSavingExtra] = useState(false);

  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [weekendSelections, setWeekendSelections] = useState<
    Record<string, WeekendSelection>
  >({});
  const [savingWeekend, setSavingWeekend] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getPauseWindowForDate = (dateLike: string | Date) => {
    const d =
      typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);

    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const pauseStart = new Date(year, month, day, 12, 0, 0, 0).getTime();
    const pauseEnd = new Date(year, month, day, 13, 0, 0, 0).getTime();

    return { pauseStart, pauseEnd };
  };

  const getOverlapMs = (
    startMs: number,
    endMs: number,
    overlapStart: number,
    overlapEnd: number
  ) => {
    const start = Math.max(startMs, overlapStart);
    const end = Math.min(endMs, overlapEnd);
    return Math.max(0, end - start);
  };

  const getWorkedMsWithoutPause = (
    startTime: string,
    endTime?: string | null
  ) => {
    const startMs = new Date(startTime).getTime();
    const endMs = endTime ? new Date(endTime).getTime() : now;

    if (endMs <= startMs) return 0;

    let total = endMs - startMs;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0,
      0
    );
    const last = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0,
      0,
      0,
      0
    );

    while (cursor.getTime() <= last.getTime()) {
      const { pauseStart, pauseEnd } = getPauseWindowForDate(cursor);
      total -= getOverlapMs(startMs, endMs, pauseStart, pauseEnd);
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(0, total);
  };

  const isNowInPauseForEntry = (startTime: string) => {
    const startMs = new Date(startTime).getTime();
    if (now < startMs) return false;

    const { pauseStart, pauseEnd } = getPauseWindowForDate(new Date(now));
    return now >= pauseStart && now < pauseEnd && startMs < pauseEnd;
  };

  const formatMsToHHMMSS = (ms: number) => {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const formatDuration = (startTime: string) => {
    const workedMs = getWorkedMsWithoutPause(startTime, null);
    return formatMsToHHMMSS(workedMs);
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString("ro-RO");
  };

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const activeWorkerIds = useMemo(() => {
    return activeEntries.map((entry) => entry.worker_id);
  }, [activeEntries]);

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id, name, beneficiary, project_location")
      .eq("id", projectId)
      .single();

    if (projectError || !projectData) {
      router.push("/pontaje");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let currentUserRole: string | null = null;

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      currentUserRole = profileData?.role || null;
    }

    const { data: activeData, error: activeError } = await supabase
      .from("time_entries")
      .select(`
        id,
        worker_id,
        start_time,
        status,
        workers:worker_id (
          id,
          full_name
        )
      `)
      .eq("project_id", projectId)
      .eq("work_date", today)
      .eq("status", "activ")
      .is("end_time", null)
      .order("start_time", { ascending: true });

    const { data: yesterdayData, error: yesterdayError } = await supabase
      .from("time_entries")
      .select("worker_id")
      .eq("project_id", projectId)
      .eq("work_date", (() => {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return yesterdayDate.toISOString().split("T")[0];
      })());

    const { data: historyData, error: historyError } = await supabase
      .from("time_entries")
      .select(`
        id,
        worker_id,
        start_time,
        end_time,
        work_date,
        status,
        workers:worker_id (
          id,
          full_name
        )
      `)
      .eq("project_id", projectId)
      .not("end_time", "is", null)
      .order("work_date", { ascending: false })
      .order("start_time", { ascending: false });

    const { data: todayWorkedData, error: todayWorkedError } = await supabase
      .from("time_entries")
      .select(`
        worker_id,
        workers:worker_id (
          id,
          full_name
        )
      `)
      .eq("project_id", projectId)
      .eq("work_date", today);

    const { data: dailyTeamData } = await supabase
      .from("daily_teams")
      .select("id, project_id, work_date")
      .eq("project_id", projectId)
      .eq("work_date", today)
      .maybeSingle();

    let plannedWorkerIdsLocal: string[] = [];
    let workerPool: Worker[] = [];

    if (dailyTeamData) {
      setPlannedTeamExists(true);
      setPlannedTeamId((dailyTeamData as DailyTeam).id);

      const { data: dailyTeamWorkersData } = await supabase
        .from("daily_team_workers")
        .select("daily_team_id, worker_id")
        .eq("daily_team_id", (dailyTeamData as DailyTeam).id);

      plannedWorkerIdsLocal = ((dailyTeamWorkersData ||
        []) as DailyTeamWorker[]).map((item) => item.worker_id);

      setPlannedWorkerIds(plannedWorkerIdsLocal);

      if (plannedWorkerIdsLocal.length > 0) {
        const { data: workersData, error: workersError } = await supabase
          .from("workers")
          .select("id, full_name, is_active, extra_hour_rate, weekend_day_rate")
          .in("id", plannedWorkerIdsLocal)
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (!workersError && workersData) {
          workerPool = workersData as Worker[];
        }
      }
    } else {
      setPlannedTeamExists(false);
      setPlannedTeamId(null);
      setPlannedWorkerIds([]);

      if (currentUserRole === "administrator") {
        const { data: workersData, error: workersError } = await supabase
          .from("workers")
          .select("id, full_name, is_active, extra_hour_rate, weekend_day_rate")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (!workersError && workersData) {
          workerPool = workersData as Worker[];
        }
      }
    }

    const enrichedActiveEntries = !activeError && activeData
      ? (activeData as ActiveTimeEntry[]).map((entry) => ({
          ...entry,
          worker_name:
            entry.workers?.[0]?.full_name ||
            workerPool.find((worker) => worker.id === entry.worker_id)
              ?.full_name ||
            "-",
        }))
      : [];

    const enrichedHistory = !historyError && historyData
      ? (historyData as HistoryTimeEntry[]).map((entry) => ({
          ...entry,
          worker_name:
            entry.workers?.[0]?.full_name ||
            workerPool.find((worker) => worker.id === entry.worker_id)
              ?.full_name ||
            "-",
        }))
      : [];

    const activeWorkerIdsLocal = enrichedActiveEntries.map(
      (entry) => entry.worker_id
    );

    const autoSelectedWorkers = workerPool
      .filter((worker) => !activeWorkerIdsLocal.includes(worker.id))
      .map((worker) => worker.id);

    setProject(projectData as Project);
    setWorkers(workerPool);
    setActiveEntries(enrichedActiveEntries);
    setHistoryEntries(enrichedHistory);
    setSelectedWorkers(autoSelectedWorkers);

    if (!todayWorkedError && todayWorkedData) {
      const map = new Map<string, TodayWorkedWorker>();

      (
        todayWorkedData as Array<{
          worker_id: string;
          workers?: { id: string; full_name: string }[] | null;
        }>
      ).forEach((item) => {
        if (!item.worker_id) return;

        const workerFromRelation = item.workers?.[0];
        const localWorker = workerPool.find((w) => w.id === item.worker_id);

        map.set(item.worker_id, {
          id: item.worker_id,
          full_name:
            workerFromRelation?.full_name || localWorker?.full_name || "-",
          extra_hour_rate: Number(localWorker?.extra_hour_rate || 0),
          weekend_day_rate: Number(localWorker?.weekend_day_rate || 0),
        });
      });

      setTodayWorkedWorkers(Array.from(map.values()));
    } else {
      setTodayWorkedWorkers([]);
    }

    if (!yesterdayError && yesterdayData) {
      const uniqueYesterdayWorkerIds = Array.from(
        new Set(yesterdayData.map((item) => item.worker_id))
      ) as string[];

      setYesterdayWorkerIds(uniqueYesterdayWorkerIds);
    } else {
      setYesterdayWorkerIds([]);
    }

    setUserRole(currentUserRole);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId, router]);

  const availableWorkers = useMemo(() => {
    return workers.filter((worker) => !activeWorkerIds.includes(worker.id));
  }, [workers, activeWorkerIds]);

  const toggleWorker = (workerId: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const toggleExtraWorker = (workerId: string) => {
    setSelectedExtraWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const updateWeekendSelection = (
    workerId: string,
    day: "saturday" | "sunday",
    checked: boolean
  ) => {
    setWeekendSelections((prev) => ({
      ...prev,
      [workerId]: {
        saturday: prev[workerId]?.saturday || false,
        sunday: prev[workerId]?.sunday || false,
        [day]: checked,
      },
    }));
  };

  const handleToggleSameTeamAsYesterday = (checked: boolean) => {
    setSameTeamAsYesterday(checked);

    if (checked) {
      const availableYesterdayWorkers = yesterdayWorkerIds.filter((workerId) =>
        availableWorkers.some((worker) => worker.id === workerId)
      );
      setSelectedWorkers(availableYesterdayWorkers);
    } else {
      const autoSelected = availableWorkers
        .filter((worker) => plannedWorkerIds.includes(worker.id))
        .map((worker) => worker.id);
      setSelectedWorkers(autoSelected);
    }
  };

  const selectedWorkersList = useMemo(() => {
    return availableWorkers.filter((worker) =>
      selectedWorkers.includes(worker.id)
    );
  }, [availableWorkers, selectedWorkers]);

  const handleStartTimeEntries = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (selectedWorkers.length === 0) {
      alert("Selectează cel puțin un muncitor.");
      return;
    }

    setSubmitting(true);

    const rows = selectedWorkers.map((workerId) => ({
      project_id: projectId,
      worker_id: workerId,
      started_by: user.id,
      start_time: new Date().toISOString(),
      work_date: today,
      status: "activ",
    }));

    const { error } = await supabase.from("time_entries").insert(rows);

    if (error) {
      alert("A apărut o eroare la pontare.");
      setSubmitting(false);
      return;
    }

    setSelectedWorkers([]);
    setSameTeamAsYesterday(false);
    setSubmitting(false);
    await loadData();
  };

  const handleStopTimeEntry = async (entryId: string) => {
    setStoppingId(entryId);

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .eq("id", entryId);

    if (error) {
      alert("A apărut o eroare la oprirea pontajului.");
      setStoppingId(null);
      return;
    }

    setStoppingId(null);
    await loadData();
  };

  const handleStopAllTimeEntries = async () => {
    if (activeEntries.length === 0) return;

    const confirmStop = window.confirm(
      "Sigur vrei să oprești pontajul pentru toți muncitorii activi?"
    );

    if (!confirmStop) return;

    setSubmitting(true);

    const activeIds = activeEntries.map((entry) => entry.id);

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .in("id", activeIds);

    if (error) {
      alert("A apărut o eroare la oprirea tuturor pontajelor.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    await loadData();
  };

  const historyGrouped = useMemo<DailyHistoryGroup[]>(() => {
    const map = new Map<string, DailyHistoryGroup>();

    for (const entry of historyEntries) {
      if (!entry.end_time) continue;

      const key = `${entry.work_date}__${entry.worker_id}`;
      const workedMs = getWorkedMsWithoutPause(entry.start_time, entry.end_time);

      if (!map.has(key)) {
        map.set(key, {
          key,
          worker_id: entry.worker_id,
          worker_name: entry.worker_name || "-",
          work_date: entry.work_date,
          first_start: entry.start_time,
          last_end: entry.end_time,
          total_ms: workedMs,
        });
      } else {
        const current = map.get(key)!;

        if (
          new Date(entry.start_time).getTime() <
          new Date(current.first_start).getTime()
        ) {
          current.first_start = entry.start_time;
        }

        if (
          new Date(entry.end_time).getTime() >
          new Date(current.last_end).getTime()
        ) {
          current.last_end = entry.end_time;
        }

        current.total_ms += workedMs;
        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const dateDiff =
        new Date(b.work_date).getTime() - new Date(a.work_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.worker_name.localeCompare(b.worker_name, "ro");
    });
  }, [historyEntries, now]);

  const filteredHistoryGrouped = useMemo(() => {
    if (historyFilter === "azi") {
      return historyGrouped.filter((item) => item.work_date === today);
    }

    if (historyFilter === "data") {
      return historyGrouped.filter(
        (item) => item.work_date === selectedHistoryDate
      );
    }

    if (historyFilter === "lunar") {
      return historyGrouped.filter((item) =>
        item.work_date.startsWith(selectedHistoryMonth)
      );
    }

    return historyGrouped;
  }, [historyGrouped, historyFilter, selectedHistoryDate, selectedHistoryMonth, today]);

  const isAdmin = userRole === "administrator" || userRole === "admin";
  const isAfterFivePM = new Date(now).getHours() >= 17;
  const isMonday = new Date(now).getDay() === 1;

  const canOpenExtraModal = isAdmin
    ? todayWorkedWorkers.length > 0
    : isAfterFivePM && activeEntries.length === 0 && todayWorkedWorkers.length > 0;

  const canOpenWeekendModal = isAdmin
    ? workers.length > 0
    : isMonday && workers.length > 0;

  const getLastWeekendDates = () => {
    const current = new Date(now);
    const currentDay = current.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

    const mondayThisWeek = new Date(current);
    mondayThisWeek.setDate(current.getDate() - daysSinceMonday);
    mondayThisWeek.setHours(0, 0, 0, 0);

    const lastSaturday = new Date(mondayThisWeek);
    lastSaturday.setDate(mondayThisWeek.getDate() - 2);
    lastSaturday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(mondayThisWeek);
    lastSunday.setDate(mondayThisWeek.getDate() - 1);
    lastSunday.setHours(0, 0, 0, 0);

    return { lastSaturday, lastSunday };
  };

  const { lastSaturday, lastSunday } = useMemo(
    () => getLastWeekendDates(),
    [now]
  );

  const saturdayDateString = useMemo(() => {
    return lastSaturday.toISOString().split("T")[0];
  }, [lastSaturday]);

  const sundayDateString = useMemo(() => {
    return lastSunday.toISOString().split("T")[0];
  }, [lastSunday]);

  const handleOpenExtraModal = () => {
    const ids = todayWorkedWorkers.map((worker) => worker.id);

    setSelectedExtraWorkers(ids);
    setApplyExtraToAll(true);
    setExtraHours("");
    setShowExtraModal(true);
  };

  const handleOpenWeekendModal = () => {
    const initialSelections: Record<string, WeekendSelection> = {};

    workers.forEach((worker) => {
      initialSelections[worker.id] = {
        saturday: false,
        sunday: false,
      };
    });

    setWeekendSelections(initialSelections);
    setShowWeekendModal(true);
  };

  const selectedExtraWorkersDetails = useMemo(() => {
    const ids = applyExtraToAll
      ? todayWorkedWorkers.map((worker) => worker.id)
      : selectedExtraWorkers;

    return todayWorkedWorkers.filter((worker) => ids.includes(worker.id));
  }, [applyExtraToAll, selectedExtraWorkers, todayWorkedWorkers]);

  const weekendSelectedWorkersCount = useMemo(() => {
    return workers.filter((worker) => {
      const selection = weekendSelections[worker.id];
      return Boolean(selection?.saturday || selection?.sunday);
    }).length;
  }, [workers, weekendSelections]);

  const weekendPreview = useMemo(() => {
    let saturdayCount = 0;
    let sundayCount = 0;
    let totalWeekendValue = 0;

    workers.forEach((worker) => {
      const selection = weekendSelections[worker.id];
      if (!selection) return;

      const rate = Number(worker.weekend_day_rate || 0);

      if (selection.saturday) {
        saturdayCount += 1;
        totalWeekendValue += rate;
      }

      if (selection.sunday) {
        sundayCount += 1;
        totalWeekendValue += rate;
      }
    });

    return {
      saturdayCount,
      sundayCount,
      totalWeekendDays: saturdayCount + sundayCount,
      totalWeekendValue,
    };
  }, [workers, weekendSelections]);

  const extraPreview = useMemo(() => {
    const parsedExtraHours = Number(extraHours || 0);

    const totalExtraValue = selectedExtraWorkersDetails.reduce((sum, worker) => {
      return sum + parsedExtraHours * Number(worker.extra_hour_rate || 0);
    }, 0);

    return {
      totalExtraValue,
    };
  }, [extraHours, selectedExtraWorkersDetails]);

  const handleSaveExtraWork = async () => {
    const parsedExtraHours = Number(extraHours || 0);

    if (!applyExtraToAll && selectedExtraWorkers.length === 0) {
      alert("Selectează cel puțin un muncitor pentru ore extra.");
      return;
    }

    if (parsedExtraHours <= 0) {
      alert("Introdu un număr valid de ore extra.");
      return;
    }

    const workersToSave = applyExtraToAll
      ? todayWorkedWorkers
      : todayWorkedWorkers.filter((worker) =>
          selectedExtraWorkers.includes(worker.id)
        );

    if (workersToSave.length === 0) {
      alert("Nu există muncitori pentru salvare.");
      return;
    }

    setSavingExtra(true);

    const workerIds = workersToSave.map((worker) => worker.id);

    const { data: existingRows, error: existingError } = await supabase
      .from("extra_work")
      .select(`
        id,
        worker_id,
        extra_hours,
        is_saturday,
        is_sunday,
        extra_hours_paid,
        weekend_paid,
        extra_hours_value,
        weekend_days_count,
        weekend_value,
        total_value
      `)
      .eq("project_id", projectId)
      .eq("work_date", today)
      .in("worker_id", workerIds);

    if (existingError) {
      alert(`Eroare citire date existente: ${existingError.message}`);
      setSavingExtra(false);
      return;
    }

    const existingMap = new Map(
      (existingRows || []).map((row) => [row.worker_id, row])
    );

    const rows = workersToSave.map((worker) => {
      const existing = existingMap.get(worker.id);
      const extraHourRate = Number(worker.extra_hour_rate || 0);

      const extraHoursValue = parsedExtraHours * extraHourRate;

      const existingWeekendDaysCount = Number(existing?.weekend_days_count || 0);
      const existingWeekendValue = Number(existing?.weekend_value || 0);
      const existingWeekendPaid = Boolean(existing?.weekend_paid || false);
      const existingIsSaturday = Boolean(existing?.is_saturday || false);
      const existingIsSunday = Boolean(existing?.is_sunday || false);

      return {
        project_id: projectId,
        worker_id: worker.id,
        work_date: today,

        extra_hours: parsedExtraHours,
        extra_hours_paid: false,
        extra_hours_value: extraHoursValue,

        is_saturday: existingIsSaturday,
        is_sunday: existingIsSunday,
        weekend_paid: existingWeekendPaid,
        weekend_days_count: existingWeekendDaysCount,
        weekend_value: existingWeekendValue,

        total_value: extraHoursValue + existingWeekendValue,
      };
    });

    const { error } = await supabase.from("extra_work").upsert(rows, {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("Eroare extra_work:", error);
      alert(`Eroare salvare ore extra: ${error.message}`);
      setSavingExtra(false);
      return;
    }

    setSavingExtra(false);
    setShowExtraModal(false);
    setExtraHours("");
    await loadData();
    alert("Orele extra au fost salvate.");
  };

  const handleSaveWeekendWork = async () => {
    const selectedSaturdayWorkers = workers.filter(
      (worker) => weekendSelections[worker.id]?.saturday
    );
    const selectedSundayWorkers = workers.filter(
      (worker) => weekendSelections[worker.id]?.sunday
    );

    if (
      selectedSaturdayWorkers.length === 0 &&
      selectedSundayWorkers.length === 0
    ) {
      alert("Bifează cel puțin o zi pentru cel puțin un muncitor.");
      return;
    }

    setSavingWeekend(true);

    const saturdayWorkerIds = selectedSaturdayWorkers.map((worker) => worker.id);
    const sundayWorkerIds = selectedSundayWorkers.map((worker) => worker.id);

    const allWeekendWorkerIds = Array.from(
      new Set([...saturdayWorkerIds, ...sundayWorkerIds])
    );

    const { data: saturdayExistingRows, error: saturdayExistingError } =
      await supabase
        .from("extra_work")
        .select(`
          id,
          worker_id,
          extra_hours,
          extra_hours_paid,
          extra_hours_value,
          weekend_paid,
          weekend_days_count,
          weekend_value,
          total_value
        `)
        .eq("project_id", projectId)
        .eq("work_date", saturdayDateString)
        .in("worker_id", allWeekendWorkerIds.length ? allWeekendWorkerIds : [""]);

    if (saturdayExistingError) {
      alert(`Eroare citire sâmbătă: ${saturdayExistingError.message}`);
      setSavingWeekend(false);
      return;
    }

    const { data: sundayExistingRows, error: sundayExistingError } =
      await supabase
        .from("extra_work")
        .select(`
          id,
          worker_id,
          extra_hours,
          extra_hours_paid,
          extra_hours_value,
          weekend_paid,
          weekend_days_count,
          weekend_value,
          total_value
        `)
        .eq("project_id", projectId)
        .eq("work_date", sundayDateString)
        .in("worker_id", allWeekendWorkerIds.length ? allWeekendWorkerIds : [""]);

    if (sundayExistingError) {
      alert(`Eroare citire duminică: ${sundayExistingError.message}`);
      setSavingWeekend(false);
      return;
    }

    const saturdayExistingMap = new Map(
      (saturdayExistingRows || []).map((row) => [row.worker_id, row])
    );

    const sundayExistingMap = new Map(
      (sundayExistingRows || []).map((row) => [row.worker_id, row])
    );

    const saturdayRows = selectedSaturdayWorkers.map((worker) => {
      const existing = saturdayExistingMap.get(worker.id);
      const weekendValue = Number(worker.weekend_day_rate || 0);
      const existingExtraValue = Number(existing?.extra_hours_value || 0);
      const existingExtraHours = Number(existing?.extra_hours || 0);
      const existingExtraPaid = Boolean(existing?.extra_hours_paid || false);

      return {
        project_id: projectId,
        worker_id: worker.id,
        work_date: saturdayDateString,

        extra_hours: existingExtraHours,
        extra_hours_paid: existingExtraPaid,
        extra_hours_value: existingExtraValue,

        is_saturday: true,
        is_sunday: false,
        weekend_paid: false,
        weekend_days_count: 1,
        weekend_value: weekendValue,

        total_value: existingExtraValue + weekendValue,
      };
    });

    const sundayRows = selectedSundayWorkers.map((worker) => {
      const existing = sundayExistingMap.get(worker.id);
      const weekendValue = Number(worker.weekend_day_rate || 0);
      const existingExtraValue = Number(existing?.extra_hours_value || 0);
      const existingExtraHours = Number(existing?.extra_hours || 0);
      const existingExtraPaid = Boolean(existing?.extra_hours_paid || false);

      return {
        project_id: projectId,
        worker_id: worker.id,
        work_date: sundayDateString,

        extra_hours: existingExtraHours,
        extra_hours_paid: existingExtraPaid,
        extra_hours_value: existingExtraValue,

        is_saturday: false,
        is_sunday: true,
        weekend_paid: false,
        weekend_days_count: 1,
        weekend_value: weekendValue,

        total_value: existingExtraValue + weekendValue,
      };
    });

    const allRows = [...saturdayRows, ...sundayRows];

    const { error } = await supabase.from("extra_work").upsert(allRows, {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("Eroare weekend_work:", error);
      alert(`Eroare salvare weekend: ${error.message}`);
      setSavingWeekend(false);
      return;
    }

    setSavingWeekend(false);
    setShowWeekendModal(false);
    await loadData();
    alert("Zilele lucrate în weekend au fost salvate.");
  };

  if (loading) {
    return <div className="p-6">Se încarcă datele șantierului...</div>;
  }

  if (!project) {
    return <div className="p-6">Șantierul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pontaj șantier</h1>
            <p className="text-sm text-gray-600">
              Selectează echipa care intră la lucru și gestionează pontajele
              active.
            </p>
          </div>

          <button
            onClick={() => router.push("/pontaje")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la șantiere
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="w-full rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Vezi istoric pontaje
            </button>
          </div>

          {canOpenExtraModal && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <button
                type="button"
                onClick={handleOpenExtraModal}
                className="w-full rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Adăugare ore extra
              </button>
            </div>
          )}

          {canOpenWeekendModal && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <button
                type="button"
                onClick={handleOpenWeekendModal}
                className="w-full rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Zile lucrate în weekend
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="text-lg font-semibold">{project.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {project.beneficiary || "-"}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium text-gray-500">Locație:</span>{" "}
              {project.project_location || "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pontaje active</h2>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                {activeEntries.length} activi
              </span>
            </div>

            {activeEntries.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu există muncitori pontați în acest moment.
              </p>
            ) : (
              <div className="space-y-2">
                {activeEntries.map((entry) => {
                  const inPause = isNowInPauseForEntry(entry.start_time);

                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-green-200 bg-green-50 p-3"
                    >
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.worker_name || "-"}
                          </p>
                          <p className="text-xs text-gray-600">
                            Intrare:{" "}
                            {new Date(entry.start_time).toLocaleTimeString(
                              "ro-RO",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }
                            )}
                          </p>
                        </div>

                        <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                          <p className="text-xs font-medium text-gray-500">
                            Cronometru
                          </p>

                          {inPause ? (
                            <div className="mt-1 flex items-center justify-between">
                              <p className="text-lg font-bold text-orange-600">
                                Pauză
                              </p>
                              <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                                12:00 - 13:00
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 text-lg font-bold text-green-700">
                              {formatDuration(entry.start_time)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStopTimeEntry(entry.id)}
                          disabled={stoppingId === entry.id || submitting}
                          className="w-full rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          {stoppingId === entry.id
                            ? "Se oprește..."
                            : "Oprește pontajul"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleStopAllTimeEntries}
                  disabled={submitting || activeEntries.length === 0}
                  className="w-full rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {submitting
                    ? "Se procesează..."
                    : "Oprește pontajul pentru toți"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Echipa de azi</h2>

              <button
                type="button"
                onClick={() => setShowWorkersList((prev) => !prev)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
                  showWorkersList ? "bg-gray-600" : "bg-[#0196ff]"
                }`}
              >
                {showWorkersList ? "Ascunde lista" : "Arată lista"}
              </button>
            </div>

            {!plannedTeamExists && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-sm font-medium text-yellow-800">
                  Nu există echipă organizată pentru azi pe acest șantier.
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  Administratorul poate ponta manual, dacă este necesar.
                </p>
              </div>
            )}

            {plannedTeamExists && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-medium text-green-800">
                  Echipa organizată pentru azi a fost încărcată automat.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Toți muncitorii atribuiți sunt bifați automat. Poți debifa
                  muncitorii lipsă.
                </p>
              </div>
            )}

            {!plannedTeamExists && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={sameTeamAsYesterday}
                    onChange={(e) =>
                      handleToggleSameTeamAsYesterday(e.target.checked)
                    }
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Aceeași echipă ca ieri
                  </span>
                </label>

                <p className="mt-2 text-xs text-gray-500">
                  Selectează automat muncitorii care au fost pontați ieri pe acest
                  șantier.
                </p>
              </div>
            )}

            {showWorkersList && (
              <div className="space-y-2">
                {availableWorkers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu există muncitori disponibili pentru pontare.
                  </p>
                ) : (
                  availableWorkers.map((worker) => (
                    <label
                      key={worker.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {worker.full_name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}

            {selectedWorkersList.length > 0 && (
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Selectați pentru pontaj:
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedWorkersList.map((worker) => (
                    <span
                      key={worker.id}
                      className="rounded-full bg-[#66CC99]/15 px-3 py-2 text-sm font-medium text-[#2f855a]"
                    >
                      {worker.full_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleStartTimeEntries}
                disabled={submitting || selectedWorkers.length === 0}
                className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Se pontează..." : "PONTEAZĂ"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Istoric pontaje</h2>
                <p className="text-sm text-gray-500">
                  Filtrează pontajele pe zi, lună sau tot proiectul.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Închide
              </button>
            </div>

            <div className="border-b px-5 py-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setHistoryFilter("azi")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    historyFilter === "azi"
                      ? "bg-[#0196ff] text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Pontaje azi
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryFilter("lunar")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    historyFilter === "lunar"
                      ? "bg-[#0196ff] text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Pontaje lunare
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryFilter("data")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    historyFilter === "data"
                      ? "bg-[#0196ff] text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Pontaje pe dată
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryFilter("proiect")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    historyFilter === "proiect"
                      ? "bg-[#0196ff] text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Pontaje pe proiect
                </button>
              </div>

              {historyFilter === "data" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Selectează data
                  </label>
                  <input
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(e) => setSelectedHistoryDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>
              )}

              {historyFilter === "lunar" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Selectează luna
                  </label>
                  <input
                    type="month"
                    value={selectedHistoryMonth}
                    onChange={(e) => setSelectedHistoryMonth(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>
              )}
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              {filteredHistoryGrouped.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nu există pontaje pentru filtrul selectat.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredHistoryGrouped.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.worker_name}
                        </p>

                        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-4">
                          <div>
                            <span className="font-medium text-gray-500">
                              Data:
                            </span>{" "}
                            {new Date(item.work_date).toLocaleDateString(
                              "ro-RO"
                            )}
                          </div>

                          <div>
                            <span className="font-medium text-gray-500">
                              Prima intrare:
                            </span>{" "}
                            {new Date(item.first_start).toLocaleTimeString(
                              "ro-RO",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }
                            )}
                          </div>

                          <div>
                            <span className="font-medium text-gray-500">
                              Ultima ieșire:
                            </span>{" "}
                            {new Date(item.last_end).toLocaleTimeString(
                              "ro-RO",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }
                            )}
                          </div>

                          <div>
                            <span className="font-medium text-gray-500">
                              Total:
                            </span>{" "}
                            <span className="font-semibold text-gray-900">
                              {formatMsToHHMMSS(item.total_ms)}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-red-600">
                          Pauza 12:00 - 13:00 este exclusă automat din calcul.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showExtraModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Adăugare ore extra</h2>
                <p className="text-sm text-gray-500">
                  Introdu orele extra pentru muncitorii pontați azi.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowExtraModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Ore extra
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={extraHours}
                    onChange={(e) => setExtraHours(e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={applyExtraToAll}
                      onChange={(e) => setApplyExtraToAll(e.target.checked)}
                      className="h-5 w-5"
                    />
                    <span className="text-sm font-medium text-gray-800">
                      Aplică pentru toți muncitorii pontați azi
                    </span>
                  </label>
                </div>

                {!applyExtraToAll && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-gray-700">
                      Selectează muncitorii
                    </p>

                    <div className="space-y-2">
                      {todayWorkedWorkers.map((worker) => (
                        <label
                          key={worker.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExtraWorkers.includes(worker.id)}
                            onChange={() => toggleExtraWorker(worker.id)}
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-medium text-gray-800">
                            {worker.full_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                  <p className="text-sm font-medium text-purple-800">
                    Muncitori selectați: {selectedExtraWorkersDetails.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-purple-900">
                    Valoare ore extra: {extraPreview.totalExtraValue.toFixed(2)} lei
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveExtraWork}
                    disabled={savingExtra}
                    className="w-full rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {savingExtra ? "Se salvează..." : "Salvează"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowExtraModal(false)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    Renunță
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWeekendModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Zile lucrate în weekend</h2>
                <p className="text-sm text-gray-500">
                  Marchează prezența pentru weekendul trecut.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowWeekendModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <p className="text-sm font-medium text-orange-800">
                  Weekend selectat:
                </p>
                <p className="mt-1 text-sm text-orange-900">
                  Sâmbătă: {formatDateLabel(lastSaturday)} | Duminică:{" "}
                  {formatDateLabel(lastSunday)}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="grid grid-cols-[2fr_1fr_1fr] bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                  <div>Nume</div>
                  <div className="text-center">
                    <div>Sâmbătă</div>
                    <div className="mt-1 text-xs font-medium text-gray-500">
                      {formatDateLabel(lastSaturday)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div>Duminică</div>
                    <div className="mt-1 text-xs font-medium text-gray-500">
                      {formatDateLabel(lastSunday)}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {workers.map((worker) => (
                    <div
                      key={worker.id}
                      className="grid grid-cols-[2fr_1fr_1fr] items-center px-4 py-3"
                    >
                      <div className="text-sm font-medium text-gray-800">
                        {worker.full_name}
                      </div>

                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={Boolean(weekendSelections[worker.id]?.saturday)}
                          onChange={(e) =>
                            updateWeekendSelection(
                              worker.id,
                              "saturday",
                              e.target.checked
                            )
                          }
                          className="h-5 w-5"
                        />
                      </div>

                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={Boolean(weekendSelections[worker.id]?.sunday)}
                          onChange={(e) =>
                            updateWeekendSelection(
                              worker.id,
                              "sunday",
                              e.target.checked
                            )
                          }
                          className="h-5 w-5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <p className="text-sm font-medium text-orange-800">
                  Muncitori selectați: {weekendSelectedWorkersCount}
                </p>
                <p className="mt-1 text-sm text-orange-800">
                  Zile marcate: {weekendPreview.totalWeekendDays}
                </p>
                <p className="mt-1 text-sm font-semibold text-orange-900">
                  Valoare weekend: {weekendPreview.totalWeekendValue.toFixed(2)} lei
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSaveWeekendWork}
                  disabled={savingWeekend}
                  className="w-full rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {savingWeekend ? "Se salvează..." : "Salvează"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowWeekendModal(false)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                >
                  Renunță
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}