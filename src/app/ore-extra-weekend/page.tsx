"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

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
};

type Worker = {
  id: string;
  full_name: string;
  extra_hour_rate: number | null;
  weekend_day_rate: number | null;
};

type TimeEntryWorkerJoin = {
  worker_id: string;
  workers?: {
    id: string;
    full_name: string;
    extra_hour_rate?: number | null;
    weekend_day_rate?: number | null;
  }[] | null;
};

type ActiveEntry = {
  id: string;
  worker_id: string;
  status: string;
  end_time: string | null;
};

type ExtraWorkHistoryRow = {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  is_saturday: boolean | null;
  is_sunday: boolean | null;
  extra_hours_paid: boolean | null;
  weekend_paid: boolean | null;
  extra_hours_value: number | null;
  weekend_days_count: number | null;
  weekend_value: number | null;
  total_value: number | null;
};

type WorkerExtraRow = {
  worker_id: string;
  full_name: string;
  extra_hour_rate: number;
  weekend_day_rate: number;
  extra_hours: string;
};

type WorkerWeekendRow = {
  worker_id: string;
  full_name: string;
  weekend_day_rate: number;
  saturday: boolean;
  sunday: boolean;
};

type HistoryWorkerRow = ExtraWorkHistoryRow & {
  full_name: string;
};

type PageMode = "extra" | "weekend" | "istoric";

const getToday = () => new Date().toISOString().split("T")[0];

const formatDateRO = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("ro-RO");

const getLast7DaysDateStrings = () => {
  const dates: string[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
};

export default function OreExtraWeekendPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [mode, setMode] = useState<PageMode>("extra");

  const [activeEntriesCount, setActiveEntriesCount] = useState(0);

  const [extraWorkers, setExtraWorkers] = useState<WorkerExtraRow[]>([]);
  const [weekendWorkers, setWeekendWorkers] = useState<WorkerWeekendRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryWorkerRow[]>([]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const hasActiveEntries = activeEntriesCount > 0;

  useEffect(() => {
    const loadBaseData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      let visibleProjects: Project[] = [];

      if (profileData.role === "administrator") {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name, beneficiary")
          .order("created_at", { ascending: false });

        visibleProjects = (projectsData as Project[]) || [];
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects } = await supabase
          .from("project_team_leads")
          .select("project_id")
          .eq("user_id", user.id);

        const projectIds = (linkedProjects || []).map((item) => item.project_id);

        if (projectIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects")
            .select("id, name, beneficiary")
            .in("id", projectIds)
            .order("created_at", { ascending: false });

          visibleProjects = (projectsData as Project[]) || [];
        }
      }

      setProjects(visibleProjects);

      if (visibleProjects.length > 0) {
        setSelectedProjectId(visibleProjects[0].id);
      }

      setLoading(false);
    };

    loadBaseData();
  }, [router]);

  useEffect(() => {
    const loadProjectData = async () => {
      if (!selectedProjectId) {
        setExtraWorkers([]);
        setWeekendWorkers([]);
        setHistoryRows([]);
        setActiveEntriesCount(0);
        return;
      }

      setLoading(true);

      const last7Days = getLast7DaysDateStrings();

      const { data: activeEntriesData } = await supabase
        .from("time_entries")
        .select("id, worker_id, status, end_time")
        .eq("project_id", selectedProjectId)
        .eq("work_date", selectedDate)
        .eq("status", "activ")
        .is("end_time", null);

      const parsedActiveEntries = (activeEntriesData as ActiveEntry[]) || [];
      setActiveEntriesCount(parsedActiveEntries.length);

      const { data: dayParticipantsData } = await supabase
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
        .eq("project_id", selectedProjectId)
        .eq("work_date", selectedDate);

      const participantMap = new Map<string, Worker>();

      ((dayParticipantsData || []) as TimeEntryWorkerJoin[]).forEach((item) => {
        const worker = item.workers?.[0];
        if (!worker?.id) return;

        participantMap.set(worker.id, {
          id: worker.id,
          full_name: worker.full_name,
          extra_hour_rate: Number(worker.extra_hour_rate || 0),
          weekend_day_rate: Number(worker.weekend_day_rate || 0),
        });
      });

      const participantIds = Array.from(participantMap.keys());

      let existingExtraMap = new Map<string, ExtraWorkHistoryRow>();

      if (participantIds.length > 0) {
        const { data: existingExtraData } = await supabase
          .from("extra_work")
          .select(`
            id,
            project_id,
            worker_id,
            work_date,
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
          .eq("project_id", selectedProjectId)
          .eq("work_date", selectedDate)
          .in("worker_id", participantIds);

        ((existingExtraData || []) as ExtraWorkHistoryRow[]).forEach((row) => {
          existingExtraMap.set(row.worker_id, row);
        });
      }

      const parsedExtraWorkers: WorkerExtraRow[] = Array.from(
        participantMap.values()
      )
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"))
        .map((worker) => {
          const existing = existingExtraMap.get(worker.id);

          return {
            worker_id: worker.id,
            full_name: worker.full_name,
            extra_hour_rate: Number(worker.extra_hour_rate || 0),
            weekend_day_rate: Number(worker.weekend_day_rate || 0),
            extra_hours:
              existing?.extra_hours !== null && existing?.extra_hours !== undefined
                ? String(existing.extra_hours)
                : "",
          };
        });

      setExtraWorkers(parsedExtraWorkers);

      const { data: last7ParticipantsData } = await supabase
        .from("time_entries")
        .select(`
          worker_id,
          workers:worker_id (
            id,
            full_name,
            weekend_day_rate
          )
        `)
        .eq("project_id", selectedProjectId)
        .in("work_date", last7Days);

      const weekendMap = new Map<string, WorkerWeekendRow>();

      ((last7ParticipantsData || []) as TimeEntryWorkerJoin[]).forEach((item) => {
        const worker = item.workers?.[0];
        if (!worker?.id) return;

        if (!weekendMap.has(worker.id)) {
          weekendMap.set(worker.id, {
            worker_id: worker.id,
            full_name: worker.full_name,
            weekend_day_rate: Number(worker.weekend_day_rate || 0),
            saturday: false,
            sunday: false,
          });
        }
      });

      const weekendIds = Array.from(weekendMap.keys());

      if (weekendIds.length > 0) {
        const { data: existingWeekendData } = await supabase
          .from("extra_work")
          .select(`
            id,
            project_id,
            worker_id,
            work_date,
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
          .eq("project_id", selectedProjectId)
          .eq("work_date", selectedDate)
          .in("worker_id", weekendIds);

        const weekendExistingMap = new Map<string, ExtraWorkHistoryRow>();
        ((existingWeekendData || []) as ExtraWorkHistoryRow[]).forEach((row) => {
          weekendExistingMap.set(row.worker_id, row);
        });

        const parsedWeekendWorkers = Array.from(weekendMap.values())
          .sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"))
          .map((worker) => {
            const existing = weekendExistingMap.get(worker.worker_id);

            return {
              ...worker,
              saturday: Boolean(existing?.is_saturday || false),
              sunday: Boolean(existing?.is_sunday || false),
            };
          });

        setWeekendWorkers(parsedWeekendWorkers);
      } else {
        setWeekendWorkers([]);
      }

      const { data: historyData } = await supabase
        .from("extra_work")
        .select(`
          id,
          project_id,
          worker_id,
          work_date,
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
        .eq("project_id", selectedProjectId)
        .in("work_date", last7Days)
        .order("work_date", { ascending: false });

      const historyWorkerIds = Array.from(
        new Set(((historyData || []) as ExtraWorkHistoryRow[]).map((row) => row.worker_id))
      );

      let historyWorkerMap = new Map<string, string>();

      if (historyWorkerIds.length > 0) {
        const { data: workersData } = await supabase
          .from("workers")
          .select("id, full_name")
          .in("id", historyWorkerIds);

        (workersData || []).forEach((worker: any) => {
          historyWorkerMap.set(worker.id, worker.full_name);
        });
      }

      const parsedHistory: HistoryWorkerRow[] = (
        (historyData || []) as ExtraWorkHistoryRow[]
      ).map((row) => ({
        ...row,
        full_name: historyWorkerMap.get(row.worker_id) || "-",
      }));

      setHistoryRows(parsedHistory);
      setLoading(false);
    };

    loadProjectData();
  }, [selectedProjectId, selectedDate]);

  const updateExtraWorker = (workerId: string, value: string) => {
    setExtraWorkers((prev) =>
      prev.map((worker) =>
        worker.worker_id === workerId
          ? { ...worker, extra_hours: value }
          : worker
      )
    );
  };

  const updateWeekendWorker = (
    workerId: string,
    field: "saturday" | "sunday",
    value: boolean
  ) => {
    setWeekendWorkers((prev) =>
      prev.map((worker) =>
        worker.worker_id === workerId ? { ...worker, [field]: value } : worker
      )
    );
  };

  const extraTotalPreview = useMemo(() => {
    return extraWorkers.reduce((sum, worker) => {
      const hours = Number(worker.extra_hours || 0);
      return sum + hours * Number(worker.extra_hour_rate || 0);
    }, 0);
  }, [extraWorkers]);

  const weekendTotalPreview = useMemo(() => {
    return weekendWorkers.reduce((sum, worker) => {
      const weekendDays = (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);
      return sum + weekendDays * Number(worker.weekend_day_rate || 0);
    }, 0);
  }, [weekendWorkers]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, HistoryWorkerRow[]>();

    historyRows.forEach((row) => {
      if (!map.has(row.worker_id)) {
        map.set(row.worker_id, []);
      }
      map.get(row.worker_id)!.push(row);
    });

    return Array.from(map.entries()).map(([workerId, rows]) => ({
      worker_id: workerId,
      worker_name: rows[0]?.full_name || "-",
      rows,
    }));
  }, [historyRows]);

  const handleSaveExtra = async () => {
    if (!selectedProjectId) {
      alert("Selectează șantierul.");
      return;
    }

    if (!selectedDate) {
      alert("Selectează data.");
      return;
    }

    if (hasActiveEntries) {
      alert("Nu poți adăuga ore cât timp echipa este pontată.");
      return;
    }

    const validRows = extraWorkers.filter(
      (worker) => Number(worker.extra_hours || 0) > 0
    );

    if (validRows.length === 0) {
      alert("Completează cel puțin o valoare de ore extra.");
      return;
    }

    setSaving(true);

    const rows = validRows.map((worker) => {
      const extraHours = Number(worker.extra_hours || 0);
      const extraValue = extraHours * Number(worker.extra_hour_rate || 0);

      return {
        project_id: selectedProjectId,
        worker_id: worker.worker_id,
        work_date: selectedDate,
        extra_hours: extraHours,
        is_saturday: false,
        is_sunday: false,
        extra_hours_paid: false,
        weekend_paid: false,
        extra_hours_value: extraValue,
        weekend_days_count: 0,
        weekend_value: 0,
        total_value: extraValue,
      };
    });

    const { error } = await supabase.from("extra_work").upsert(rows, {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    if (error) {
      alert(`A apărut o eroare la salvare: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Orele extra au fost salvate.");
  };

  const handleSaveWeekend = async () => {
    if (!selectedProjectId) {
      alert("Selectează șantierul.");
      return;
    }

    if (!selectedDate) {
      alert("Selectează data.");
      return;
    }

    const validRows = weekendWorkers.filter(
      (worker) => worker.saturday || worker.sunday
    );

    if (validRows.length === 0) {
      alert("Bifează cel puțin o zi de weekend.");
      return;
    }

    setSaving(true);

    const rows = validRows.map((worker) => {
      const weekendDays = (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);
      const weekendValue = weekendDays * Number(worker.weekend_day_rate || 0);

      return {
        project_id: selectedProjectId,
        worker_id: worker.worker_id,
        work_date: selectedDate,
        extra_hours: 0,
        is_saturday: worker.saturday,
        is_sunday: worker.sunday,
        extra_hours_paid: false,
        weekend_paid: false,
        extra_hours_value: 0,
        weekend_days_count: weekendDays,
        weekend_value: weekendValue,
        total_value: weekendValue,
      };
    });

    const { error } = await supabase.from("extra_work").upsert(rows, {
      onConflict: "project_id,worker_id,work_date",
      ignoreDuplicates: false,
    });

    if (error) {
      alert(`A apărut o eroare la salvare: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Zilele de weekend au fost salvate.");
  };

  const renderMoneyIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 9h.01M17 15h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0EEE9] flex items-center justify-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-[#0196ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi
          </button>

          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={44}
            className="h-10 w-auto object-contain sm:h-11"
          />

          <div className="w-[88px]" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderMoneyIcon()}
            </div>

            <div>
              <p className="text-sm text-gray-500">Financiar echipă</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Ore Extra / Weekend
              </h1>
              <p className="mt-3 text-sm text-gray-500 sm:text-base">
                Completezi ore extra, weekend și vezi istoricul echipei pe șantier.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Șantier
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              >
                <option value="">Selectează șantier</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>
          </div>

          {selectedProject && (
            <div className="mt-4 rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
              <p className="text-sm font-semibold text-gray-900">
                {selectedProject.name}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {selectedProject.beneficiary || "-"}
              </p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode("extra")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                mode === "extra"
                  ? "bg-[#0196ff] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Ore Extra
            </button>

            <button
              type="button"
              onClick={() => setMode("weekend")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                mode === "weekend"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Zi de weekend
            </button>

            <button
              type="button"
              onClick={() => setMode("istoric")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                mode === "istoric"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Istoric ore / weekend
            </button>
          </div>
        </section>

        {mode === "extra" && (
          <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Ore extra pe data selectată
                </h2>
                <p className="text-sm text-gray-500">
                  Orele extra pot fi adăugate doar după oprirea pontajelor.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {extraWorkers.length} muncitori
              </div>
            </div>

            {hasActiveEntries ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                <p className="text-sm font-semibold text-red-800">
                  Nu poți adăuga ore, echipa este pontată în acest moment!
                </p>
              </div>
            ) : extraWorkers.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu există muncitori participanți pe șantier în data selectată.
              </p>
            ) : (
              <div className="space-y-3">
                {extraWorkers.map((worker) => {
                  const extraValue =
                    Number(worker.extra_hours || 0) *
                    Number(worker.extra_hour_rate || 0);

                  return (
                    <div
                      key={worker.worker_id}
                      className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {worker.full_name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            Tarif ore extra: {worker.extra_hour_rate.toFixed(2)} lei/oră
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Ore extra
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={worker.extra_hours}
                              onChange={(e) =>
                                updateExtraWorker(worker.worker_id, e.target.value)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                            />
                          </div>

                          <div className="rounded-xl bg-purple-50 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-purple-400">
                              Valoare
                            </p>
                            <p className="mt-1 text-sm font-bold text-purple-700">
                              {extraValue.toFixed(2)} lei
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                  <p className="text-sm font-medium text-green-800">
                    Total ore extra
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-green-900">
                    {extraTotalPreview.toFixed(2)} lei
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveExtra}
                  disabled={saving}
                  className="w-full rounded-2xl bg-[#0196ff] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Se salvează..." : "Salvează ore extra"}
                </button>
              </div>
            )}
          </section>
        )}

        {mode === "weekend" && (
          <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Zi de weekend
                </h2>
                <p className="text-sm text-gray-500">
                  Apar muncitorii care au participat pe șantier în ultimele 7 zile.
                </p>
              </div>

              <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {weekendWorkers.length} muncitori
              </div>
            </div>

            {weekendWorkers.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu există muncitori participanți pe acest șantier în ultimele 7 zile.
              </p>
            ) : (
              <div className="space-y-3">
                {weekendWorkers.map((worker) => {
                  const weekendDays =
                    (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);
                  const weekendValue =
                    weekendDays * Number(worker.weekend_day_rate || 0);

                  return (
                    <div
                      key={worker.worker_id}
                      className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {worker.full_name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            Tarif weekend: {worker.weekend_day_rate.toFixed(2)} lei/zi
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <input
                              type="checkbox"
                              checked={worker.saturday}
                              onChange={(e) =>
                                updateWeekendWorker(
                                  worker.worker_id,
                                  "saturday",
                                  e.target.checked
                                )
                              }
                              className="h-5 w-5"
                            />
                            <span className="text-sm font-medium text-gray-800">
                              Sâmbătă
                            </span>
                          </label>

                          <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <input
                              type="checkbox"
                              checked={worker.sunday}
                              onChange={(e) =>
                                updateWeekendWorker(
                                  worker.worker_id,
                                  "sunday",
                                  e.target.checked
                                )
                              }
                              className="h-5 w-5"
                            />
                            <span className="text-sm font-medium text-gray-800">
                              Duminică
                            </span>
                          </label>

                          <div className="rounded-xl bg-orange-50 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-orange-400">
                              Valoare
                            </p>
                            <p className="mt-1 text-sm font-bold text-orange-700">
                              {weekendValue.toFixed(2)} lei
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                  <p className="text-sm font-medium text-green-800">
                    Total weekend
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-green-900">
                    {weekendTotalPreview.toFixed(2)} lei
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWeekend}
                  disabled={saving}
                  className="w-full rounded-2xl bg-orange-600 px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Se salvează..." : "Salvează zi de weekend"}
                </button>
              </div>
            )}
          </section>
        )}

        {mode === "istoric" && (
          <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Istoric ore și weekend echipă
              </h2>
              <p className="text-sm text-gray-500">
                Se afișează istoricul muncitorilor care au participat pe șantier în ultimele 7 zile.
              </p>
            </div>

            {groupedHistory.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu există istoric pentru șantierul selectat.
              </p>
            ) : (
              <div className="space-y-4">
                {groupedHistory.map((group) => (
                  <div
                    key={group.worker_id}
                    className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4"
                  >
                    <p className="text-base font-semibold text-gray-900">
                      {group.worker_name}
                    </p>

                    <div className="mt-4 space-y-3">
                      {group.rows.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                        >
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Data
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {formatDateRO(row.work_date)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Ore extra
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {Number(row.extra_hours || 0).toFixed(2)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Weekend
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {[
                                  row.is_saturday ? "Sâmbătă" : null,
                                  row.is_sunday ? "Duminică" : null,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "-"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Total
                              </p>
                              <p className="mt-1 text-sm font-semibold text-gray-900">
                                {Number(row.total_value || 0).toFixed(2)} lei
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Extra
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {row.extra_hours_paid ? "Achitat" : "Neachitat"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                                Weekend
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-900">
                                {row.weekend_paid ? "Achitat" : "Neachitat"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
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