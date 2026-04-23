"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  status: string;
};

type DailyTeam = {
  id: string;
  project_id: string;
  work_date: string;
  created_at?: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
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

type ProjectCardData = {
  workers: Worker[];
  selectedWorkers: string[];
  activeEntries: ActiveTimeEntry[];
  loading: boolean;
  submitting: boolean;
  stoppingId: string | null;
  sameTeamAsYesterday: boolean;
  yesterdayWorkerIds: string[];
  plannedTeamExists: boolean;
  plannedWorkerIds: string[];
};

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const createInitialCardData = (): ProjectCardData => ({
  workers: [],
  selectedWorkers: [],
  activeEntries: [],
  loading: false,
  submitting: false,
  stoppingId: null,
  sameTeamAsYesterday: false,
  yesterdayWorkerIds: [],
  plannedTeamExists: false,
  plannedWorkerIds: [],
});

export default function PontajePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCards, setProjectCards] = useState<Record<string, ProjectCardData>>({});
  const [now, setNow] = useState(Date.now());

  const todayDate = useMemo(() => getTodayDate(), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getPauseWindowForDate = (dateLike: string | Date) => {
    const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
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

  const getWorkedMsWithoutPause = (startTime: string, endTime?: string | null) => {
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
      0, 0, 0, 0
    );
    const last = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0, 0, 0, 0
    );

    while (cursor.getTime() <= last.getTime()) {
      const { pauseStart, pauseEnd } = getPauseWindowForDate(cursor);
      total -= getOverlapMs(startMs, endMs, pauseStart, pauseEnd);
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(0, total);
  };

  const formatMsToHHMMSS = (ms: number) => {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const formatDuration = (startTime: string) => {
    const workedMs = getWorkedMsWithoutPause(startTime, null);
    return formatMsToHHMMSS(workedMs);
  };

  const isNowInPauseForEntry = (startTime: string) => {
    const startMs = new Date(startTime).getTime();
    if (now < startMs) return false;
    const { pauseStart, pauseEnd } = getPauseWindowForDate(new Date(now));
    return now >= pauseStart && now < pauseEnd && startMs < pauseEnd;
  };

  const setCardData = (
    projectId: string,
    updater: (prev: ProjectCardData) => ProjectCardData
  ) => {
    setProjectCards((prev) => ({
      ...prev,
      [projectId]: updater(prev[projectId] || createInitialCardData()),
    }));
  };

  const loadProjectCardData = async (
    projectId: string,
    currentUserRole?: string | null
  ) => {
    setCardData(projectId, (prev) => ({ ...prev, loading: true }));

    const { data: { user } } = await supabase.auth.getUser();

    let role = currentUserRole || null;

    if (!role && user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      role = profileData?.role || null;
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
      .eq("work_date", todayDate)
      .eq("status", "activ")
      .is("end_time", null)
      .order("start_time", { ascending: true });

    const { data: yesterdayData } = await supabase
      .from("time_entries")
      .select("worker_id")
      .eq("project_id", projectId)
      .eq(
        "work_date",
        (() => {
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          return yesterdayDate.toISOString().split("T")[0];
        })()
      );

    const { data: dailyTeamData } = await supabase
      .from("daily_teams")
      .select("id, project_id, work_date")
      .eq("project_id", projectId)
      .eq("work_date", todayDate)
      .maybeSingle();

    let plannedWorkerIdsLocal: string[] = [];
    let workerPool: Worker[] = [];

    if (dailyTeamData) {
      const { data: dailyTeamWorkersData } = await supabase
        .from("daily_team_workers")
        .select("daily_team_id, worker_id")
        .eq("daily_team_id", (dailyTeamData as DailyTeam).id);

      plannedWorkerIdsLocal = (dailyTeamWorkersData || []).map((item) => item.worker_id);

      if (plannedWorkerIdsLocal.length > 0) {
        const { data: workersData } = await supabase
          .from("workers")
          .select("id, full_name, is_active")
          .in("id", plannedWorkerIdsLocal)
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        workerPool = (workersData as Worker[]) || [];
      }
    } else if (role === "administrator") {
      const { data: workersData } = await supabase
        .from("workers")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      workerPool = (workersData as Worker[]) || [];
    }

    const enrichedActiveEntries =
      !activeError && activeData
        ? (activeData as ActiveTimeEntry[]).map((entry) => ({
            ...entry,
            worker_name:
              entry.workers?.[0]?.full_name ||
              workerPool.find((worker) => worker.id === entry.worker_id)?.full_name ||
              "-",
          }))
        : [];

    const activeWorkerIdsLocal = enrichedActiveEntries.map((entry) => entry.worker_id);

    const autoSelectedWorkers = workerPool
      .filter((worker) => !activeWorkerIdsLocal.includes(worker.id))
      .map((worker) => worker.id);

    const uniqueYesterdayWorkerIds = Array.from(
      new Set((yesterdayData || []).map((item) => item.worker_id))
    ) as string[];

    setCardData(projectId, (prev) => ({
      ...prev,
      workers: workerPool,
      activeEntries: enrichedActiveEntries,
      selectedWorkers:
        prev.selectedWorkers.length > 0
          ? prev.selectedWorkers
          : autoSelectedWorkers,
      loading: false,
      plannedTeamExists: Boolean(dailyTeamData),
      plannedWorkerIds: plannedWorkerIdsLocal,
      yesterdayWorkerIds: uniqueYesterdayWorkerIds,
    }));
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        router.push("/login");
        return;
      }

      if (
        profileData.role !== "administrator" &&
        profileData.role !== "sef_echipa"
      ) {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData as Profile);

      const { data: dailyTeamsData, error: dailyTeamsError } = await supabase
        .from("daily_teams")
        .select("id, project_id, work_date, created_at")
        .eq("work_date", todayDate)
        .order("created_at", { ascending: true });

      if (dailyTeamsError || !dailyTeamsData || dailyTeamsData.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const teamProjectIds = Array.from(
        new Set((dailyTeamsData as DailyTeam[]).map((item) => item.project_id))
      );

      if (teamProjectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      let visibleProjects: Project[] = [];

      if (profileData.role === "administrator") {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, project_location, status")
          .in("id", teamProjectIds)
          .order("created_at", { ascending: false });

        if (!projectsError && projectsData) {
          visibleProjects = projectsData as Project[];
        }
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects, error: linkedError } = await supabase
          .from("project_team_leads")
          .select("project_id")
          .eq("user_id", user.id);

        if (linkedError || !linkedProjects) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const linkedProjectIds = linkedProjects.map((item) => item.project_id);
        const visibleProjectIds = teamProjectIds.filter((projectId) =>
          linkedProjectIds.includes(projectId)
        );

        if (visibleProjectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, project_location, status")
          .in("id", visibleProjectIds)
          .order("created_at", { ascending: false });

        if (!projectsError && projectsData) {
          visibleProjects = projectsData as Project[];
        }
      }

      setProjects(visibleProjects);

      const initialCards: Record<string, ProjectCardData> = {};
      visibleProjects.forEach((project) => {
        initialCards[project.id] = createInitialCardData();
      });
      setProjectCards(initialCards);

      await Promise.all(
        visibleProjects.map((project) =>
          loadProjectCardData(project.id, profileData.role)
        )
      );

      setLoading(false);
    };

    loadData();
  }, [router, todayDate]);

  const toggleWorker = (projectId: string, workerId: string) => {
    setCardData(projectId, (prev) => ({
      ...prev,
      selectedWorkers: prev.selectedWorkers.includes(workerId)
        ? prev.selectedWorkers.filter((id) => id !== workerId)
        : [...prev.selectedWorkers, workerId],
    }));
  };

  const handleToggleSameTeamAsYesterday = (projectId: string, checked: boolean) => {
    setCardData(projectId, (prev) => {
      const activeWorkerIds = prev.activeEntries.map((entry) => entry.worker_id);
      const availableWorkers = prev.workers.filter(
        (worker) => !activeWorkerIds.includes(worker.id)
      );

      if (checked) {
        const availableYesterdayWorkers = prev.yesterdayWorkerIds.filter((workerId) =>
          availableWorkers.some((worker) => worker.id === workerId)
        );
        return {
          ...prev,
          sameTeamAsYesterday: true,
          selectedWorkers: availableYesterdayWorkers,
        };
      }

      const autoSelected = availableWorkers
        .filter((worker) => prev.plannedWorkerIds.includes(worker.id))
        .map((worker) => worker.id);

      return {
        ...prev,
        sameTeamAsYesterday: false,
        selectedWorkers: autoSelected,
      };
    });
  };

  const handleStartTimeEntries = async (projectId: string) => {
    const card = projectCards[projectId];
    if (!card) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (card.selectedWorkers.length === 0) {
      alert("Selectează cel puțin un muncitor.");
      return;
    }

    setCardData(projectId, (prev) => ({ ...prev, submitting: true }));

    const rows = card.selectedWorkers.map((workerId) => ({
      project_id: projectId,
      worker_id: workerId,
      started_by: user.id,
      start_time: new Date().toISOString(),
      work_date: todayDate,
      status: "activ",
    }));

    const { error } = await supabase.from("time_entries").insert(rows);

    if (error) {
      alert("A apărut o eroare la pontare.");
      setCardData(projectId, (prev) => ({ ...prev, submitting: false }));
      return;
    }

    setCardData(projectId, (prev) => ({
      ...prev,
      submitting: false,
      selectedWorkers: [],
      sameTeamAsYesterday: false,
    }));

    await loadProjectCardData(projectId, profile?.role || null);
  };

  const handleStopTimeEntry = async (projectId: string, entryId: string) => {
    setCardData(projectId, (prev) => ({ ...prev, stoppingId: entryId }));

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .eq("id", entryId);

    if (error) {
      alert("A apărut o eroare la oprirea pontajului.");
      setCardData(projectId, (prev) => ({ ...prev, stoppingId: null }));
      return;
    }

    setCardData(projectId, (prev) => ({ ...prev, stoppingId: null }));
    await loadProjectCardData(projectId, profile?.role || null);
  };

  const handleStopAllTimeEntries = async (projectId: string) => {
    const card = projectCards[projectId];
    if (!card || card.activeEntries.length === 0) return;

    const confirmStop = window.confirm(
      "Sigur vrei să oprești pontajul pentru toți muncitorii activi?"
    );
    if (!confirmStop) return;

    setCardData(projectId, (prev) => ({ ...prev, submitting: true }));

    const activeIds = card.activeEntries.map((entry) => entry.id);

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .in("id", activeIds);

    if (error) {
      alert("A apărut o eroare la oprirea tuturor pontajelor.");
      setCardData(projectId, (prev) => ({ ...prev, submitting: false }));
      return;
    }

    setCardData(projectId, (prev) => ({ ...prev, submitting: false }));
    await loadProjectCardData(projectId, profile?.role || null);
  };

  const getStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getStatusClasses = (status: string) => {
    if (status === "in_asteptare") return "bg-yellow-100 text-yellow-700";
    if (status === "in_lucru") return "bg-[#0196ff]/10 text-[#0196ff]";
    if (status === "finalizat") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const renderPontajIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 2v4M15 2v4M8 10h8M8 14h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  if (loading) {
    return <div className="p-6">Se încarcă șantierele pentru pontaj...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderPontajIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Pontaje zilnice</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Pontare
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Pontează direct din cardul șantierului și gestionează echipa activă.
              </p>
              <p className="mt-2 text-sm font-medium text-gray-400">
                {profile?.full_name} •{" "}
                {new Date(todayDate).toLocaleDateString("ro-RO")}
              </p>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Șantiere disponibile azi
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {projects.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există șantiere cu echipe organizate pentru azi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const card = projectCards[project.id] || createInitialCardData();
                const activeWorkerIds = card.activeEntries.map((e) => e.worker_id);
                const availableWorkers = card.workers.filter(
                  (w) => !activeWorkerIds.includes(w.id)
                );
                const selectedWorkersList = availableWorkers.filter((w) =>
                  card.selectedWorkers.includes(w.id)
                );
                const hasActive = card.activeEntries.length > 0;

                return (
                  <div
                    key={project.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                          {renderPontajIcon()}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {project.name}
                          </h2>
                          <p className="mt-1 text-sm text-gray-500">
                            {project.beneficiary || "-"}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {project.project_location || "-"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(project.status)}`}
                      >
                        {getStatusLabel(project.status)}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {/* ── STARE: fără pontaje active → selector muncitori ── */}
                      {!hasActive && (
                        <>
                          {card.loading ? (
                            <p className="text-sm text-gray-500">Se încarcă echipa...</p>
                          ) : (
                            <>
                              {!card.plannedTeamExists && (
                                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                                  <p className="text-sm font-medium text-yellow-800">
                                    Nu există echipă organizată pentru azi pe acest șantier.
                                  </p>
                                  <p className="mt-1 text-xs text-yellow-700">
                                    Administratorul poate ponta manual, dacă este necesar.
                                  </p>
                                </div>
                              )}

                              {card.plannedTeamExists && (
                                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                                  <p className="text-sm font-medium text-green-800">
                                    Echipa organizată pentru azi a fost încărcată automat.
                                  </p>
                                  <p className="mt-1 text-xs text-green-700">
                                    Dacă lipsește cineva, îl poți debifa înainte de pontare.
                                  </p>
                                </div>
                              )}

                              {!card.plannedTeamExists && (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                                  <label className="flex cursor-pointer items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={card.sameTeamAsYesterday}
                                      onChange={(e) =>
                                        handleToggleSameTeamAsYesterday(
                                          project.id,
                                          e.target.checked
                                        )
                                      }
                                      className="h-5 w-5"
                                    />
                                    <span className="text-sm font-medium text-gray-800">
                                      Aceeași echipă ca ieri
                                    </span>
                                  </label>
                                </div>
                              )}

                              {availableWorkers.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  Nu există muncitori disponibili pentru pontare.
                                </p>
                              ) : (
                                <>
                                  <div>
                                    <p className="mb-3 text-sm font-semibold text-gray-900">
                                      Echipa pentru pontare
                                    </p>
                                    <div className="space-y-2">
                                      {availableWorkers.map((worker) => (
                                        <label
                                          key={worker.id}
                                          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={card.selectedWorkers.includes(worker.id)}
                                            onChange={() =>
                                              toggleWorker(project.id, worker.id)
                                            }
                                            className="h-5 w-5"
                                          />
                                          <span className="text-sm font-medium text-gray-800">
                                            {worker.full_name}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  {selectedWorkersList.length > 0 && (
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
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* ── STARE: pontaje active → listă muncitori ── */}
                      {hasActive && (
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-gray-900">
                              Muncitori pontați
                            </h3>
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              {card.activeEntries.length} activi
                            </span>
                          </div>

                          <div className="mb-2 flex items-center gap-2 px-1">
                            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Nume
                            </span>
                            <span className="w-20 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Timp
                            </span>
                            <span className="w-16 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Acțiune
                            </span>
                          </div>

                          <div className="space-y-2">
                            {card.activeEntries.map((entry) => {
                              const inPause = isNowInPauseForEntry(entry.start_time);
                              return (
                                <div
                                  key={entry.id}
                                  className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${
                                    inPause
                                      ? "border-orange-200 bg-orange-50"
                                      : "border-green-200 bg-green-50"
                                  }`}
                                >
                                  <span className="flex-1 truncate text-sm font-semibold text-gray-900">
                                    {entry.worker_name || "-"}
                                  </span>
                                  <span
                                    className={`w-20 text-center text-sm font-bold tabular-nums ${
                                      inPause ? "text-orange-600" : "text-green-700"
                                    }`}
                                  >
                                    {inPause ? "Pauză" : formatDuration(entry.start_time)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleStopTimeEntry(project.id, entry.id)
                                    }
                                    disabled={
                                      card.stoppingId === entry.id || card.submitting
                                    }
                                    className="w-16 rounded-xl bg-red-600 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                  >
                                    {card.stoppingId === entry.id ? "..." : "Stop"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Buton principal ── */}
                      <button
                        type="button"
                        onClick={() =>
                          hasActive
                            ? handleStopAllTimeEntries(project.id)
                            : handleStartTimeEntries(project.id)
                        }
                        disabled={
                          card.submitting ||
                          card.loading ||
                          (!hasActive && card.selectedWorkers.length === 0)
                        }
                        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${
                          hasActive ? "bg-red-600" : "bg-green-600"
                        }`}
                      >
                        {card.submitting
                          ? "Se procesează..."
                          : hasActive
                          ? "■ Oprește toți"
                          : "Pontează"}
                      </button>
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
