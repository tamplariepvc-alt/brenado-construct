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
};

type Worker = {
  id: string;
  full_name: string;
  extra_hour_rate: number | null;
  weekend_day_rate: number | null;
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

type ExtraWorkRow = {
  id?: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  is_saturday: boolean | null;
  is_sunday: boolean | null;
  extra_hours_paid?: boolean | null;
  weekend_paid?: boolean | null;
  extra_hours_value?: number | null;
  weekend_days_count?: number | null;
  weekend_value?: number | null;
  total_value?: number | null;
};

type HistoryRow = {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  is_saturday: boolean | null;
  is_sunday: boolean | null;
  extra_hours_value: number | null;
  weekend_value: number | null;
  total_value: number | null;
};

type WorkerFormRow = {
  worker_id: string;
  full_name: string;
  extra_hour_rate: number;
  weekend_day_rate: number;
  extra_hours: string;
  saturday: boolean;
  sunday: boolean;
};

const getToday = () => new Date().toISOString().split("T")[0];

export default function OreExtraWeekendPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());

  const [teamWorkers, setTeamWorkers] = useState<WorkerFormRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

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

      if (profileData.role === "administrator") {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name, beneficiary")
          .order("created_at", { ascending: false });

        const parsedProjects = (projectsData as Project[]) || [];
        setProjects(parsedProjects);

        if (parsedProjects.length > 0) {
          setSelectedProjectId(parsedProjects[0].id);
        }
      } else {
        const { data: linkedProjects } = await supabase
          .from("project_team_leads")
          .select("project_id")
          .eq("user_id", user.id);

        const projectIds = (linkedProjects || []).map((item) => item.project_id);

        if (projectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name, beneficiary")
          .in("id", projectIds)
          .order("created_at", { ascending: false });

        const parsedProjects = (projectsData as Project[]) || [];
        setProjects(parsedProjects);

        if (parsedProjects.length > 0) {
          setSelectedProjectId(parsedProjects[0].id);
        }
      }

      setLoading(false);
    };

    loadBaseData();
  }, [router]);

  useEffect(() => {
    const loadProjectDateData = async () => {
      if (!selectedProjectId || !selectedDate) {
        setTeamWorkers([]);
        setHistoryRows([]);
        return;
      }

      setLoading(true);

      const { data: dailyTeamData } = await supabase
        .from("daily_teams")
        .select("id, project_id, work_date")
        .eq("project_id", selectedProjectId)
        .eq("work_date", selectedDate)
        .maybeSingle();

      let workerIds: string[] = [];

      if (dailyTeamData) {
        const { data: dailyTeamWorkersData } = await supabase
          .from("daily_team_workers")
          .select("daily_team_id, worker_id")
          .eq("daily_team_id", (dailyTeamData as DailyTeam).id);

        workerIds = ((dailyTeamWorkersData || []) as DailyTeamWorker[]).map(
          (item) => item.worker_id
        );
      }

      if (workerIds.length === 0) {
        const { data: timeEntriesData } = await supabase
          .from("time_entries")
          .select("worker_id")
          .eq("project_id", selectedProjectId)
          .eq("work_date", selectedDate);

        workerIds = Array.from(
          new Set((timeEntriesData || []).map((item: any) => item.worker_id))
        );
      }

      if (workerIds.length === 0) {
        setTeamWorkers([]);
      } else {
        const { data: workersData } = await supabase
          .from("workers")
          .select("id, full_name, extra_hour_rate, weekend_day_rate")
          .in("id", workerIds)
          .eq("is_active", true)
          .order("full_name", { ascending: true });

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
            extra_hours_value,
            weekend_value,
            total_value
          `)
          .eq("project_id", selectedProjectId)
          .eq("work_date", selectedDate)
          .in("worker_id", workerIds);

        const existingMap = new Map<string, ExtraWorkRow>();
        ((existingExtraData || []) as ExtraWorkRow[]).forEach((row) => {
          existingMap.set(row.worker_id, row);
        });

        const parsedWorkers: WorkerFormRow[] = ((workersData || []) as Worker[]).map(
          (worker) => {
            const existing = existingMap.get(worker.id);

            return {
              worker_id: worker.id,
              full_name: worker.full_name,
              extra_hour_rate: Number(worker.extra_hour_rate || 0),
              weekend_day_rate: Number(worker.weekend_day_rate || 0),
              extra_hours:
                existing?.extra_hours !== null && existing?.extra_hours !== undefined
                  ? String(existing.extra_hours)
                  : "",
              saturday: Boolean(existing?.is_saturday || false),
              sunday: Boolean(existing?.is_sunday || false),
            };
          }
        );

        setTeamWorkers(parsedWorkers);
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
          extra_hours_value,
          weekend_value,
          total_value
        `)
        .eq("project_id", selectedProjectId)
        .order("work_date", { ascending: false });

      const historyWorkerIds = Array.from(
        new Set(((historyData || []) as HistoryRow[]).map((row) => row.worker_id))
      );

      let historyWorkerMap = new Map<string, string>();

      if (historyWorkerIds.length > 0) {
        const { data: historyWorkersData } = await supabase
          .from("workers")
          .select("id, full_name")
          .in("id", historyWorkerIds);

        historyWorkerMap = new Map(
          (historyWorkersData || []).map((worker: any) => [worker.id, worker.full_name])
        );
      }

      const parsedHistory = ((historyData || []) as HistoryRow[]).map((row) => ({
        ...row,
        full_name: historyWorkerMap.get(row.worker_id) || "-",
      })) as Array<HistoryRow & { full_name: string }>;

      setHistoryRows(parsedHistory);
      setLoading(false);
    };

    loadProjectDateData();
  }, [selectedProjectId, selectedDate]);

  const updateWorkerRow = (
    workerId: string,
    field: "extra_hours" | "saturday" | "sunday",
    value: string | boolean
  ) => {
    setTeamWorkers((prev) =>
      prev.map((worker) =>
        worker.worker_id === workerId ? { ...worker, [field]: value } : worker
      )
    );
  };

  const totalPreview = useMemo(() => {
    return teamWorkers.reduce(
      (sum, worker) => {
        const extraHours = Number(worker.extra_hours || 0);
        const extraValue = extraHours * worker.extra_hour_rate;
        const weekendDays =
          (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);
        const weekendValue = weekendDays * worker.weekend_day_rate;

        return sum + extraValue + weekendValue;
      },
      0
    );
  }, [teamWorkers]);

  const handleSave = async () => {
    if (!selectedProjectId) {
      alert("Selectează șantierul.");
      return;
    }

    if (!selectedDate) {
      alert("Selectează data.");
      return;
    }

    if (teamWorkers.length === 0) {
      alert("Nu există muncitori pentru data selectată.");
      return;
    }

    const validRows = teamWorkers.filter((worker) => {
      const extraHours = Number(worker.extra_hours || 0);
      return extraHours > 0 || worker.saturday || worker.sunday;
    });

    if (validRows.length === 0) {
      alert("Completează cel puțin o valoare de ore extra sau weekend.");
      return;
    }

    setSaving(true);

    const rows = validRows.map((worker) => {
      const extraHours = Number(worker.extra_hours || 0);
      const weekendDays =
        (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);

      const extraValue = extraHours * Number(worker.extra_hour_rate || 0);
      const weekendValue = weekendDays * Number(worker.weekend_day_rate || 0);

      return {
        project_id: selectedProjectId,
        worker_id: worker.worker_id,
        work_date: selectedDate,
        extra_hours: extraHours,
        is_saturday: worker.saturday,
        is_sunday: worker.sunday,
        extra_hours_paid: false,
        weekend_paid: false,
        extra_hours_value: extraValue,
        weekend_days_count: weekendDays,
        weekend_value: weekendValue,
        total_value: extraValue + weekendValue,
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
    alert("Orele extra și weekendul au fost salvate.");
  };

  const groupedHistory = useMemo(() => {
    const map = new Map<string, Array<HistoryRow & { full_name?: string }>>();

    (historyRows as Array<HistoryRow & { full_name?: string }>).forEach((row) => {
      const key = row.worker_id;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    });

    return Array.from(map.entries()).map(([workerId, rows]) => ({
      worker_id: workerId,
      worker_name: rows[0]?.full_name || "-",
      rows,
    }));
  }, [historyRows]);

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
                Completezi pe dată orele extra și zilele de weekend pentru muncitorii din echipa ta.
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
        </section>

        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Muncitori pe data selectată
              </h2>
              <p className="text-sm text-gray-500">
                Ore extra și weekend se salvează individual pe fiecare muncitor.
              </p>
            </div>

            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {teamWorkers.length} muncitori
            </div>
          </div>

          {teamWorkers.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nu există muncitori în echipă pentru data selectată.
            </p>
          ) : (
            <div className="space-y-3">
              {teamWorkers.map((worker) => {
                const extraHours = Number(worker.extra_hours || 0);
                const weekendDays =
                  (worker.saturday ? 1 : 0) + (worker.sunday ? 1 : 0);
                const extraValue = extraHours * worker.extra_hour_rate;
                const weekendValue = weekendDays * worker.weekend_day_rate;
                const totalValue = extraValue + weekendValue;

                return (
                  <div
                    key={worker.worker_id}
                    className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {worker.full_name}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700">
                            Tarif extra: {worker.extra_hour_rate.toFixed(2)} lei/oră
                          </span>
                          <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">
                            Tarif weekend: {worker.weekend_day_rate.toFixed(2)} lei/zi
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                              updateWorkerRow(
                                worker.worker_id,
                                "extra_hours",
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                          />
                        </div>

                        <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <input
                            type="checkbox"
                            checked={worker.saturday}
                            onChange={(e) =>
                              updateWorkerRow(
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
                              updateWorkerRow(
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
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-purple-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-purple-400">
                          Valoare extra
                        </p>
                        <p className="mt-1 text-sm font-bold text-purple-700">
                          {extraValue.toFixed(2)} lei
                        </p>
                      </div>

                      <div className="rounded-xl bg-orange-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-orange-400">
                          Valoare weekend
                        </p>
                        <p className="mt-1 text-sm font-bold text-orange-700">
                          {weekendValue.toFixed(2)} lei
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-blue-400">
                          Total
                        </p>
                        <p className="mt-1 text-sm font-bold text-blue-700">
                          {totalValue.toFixed(2)} lei
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                <p className="text-sm font-medium text-green-800">
                  Total general pentru data selectată
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-green-900">
                  {totalPreview.toFixed(2)} lei
                </p>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-2xl bg-[#0196ff] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Se salvează..." : "Salvează ore extra / weekend"}
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Istoric pe muncitori
            </h2>
            <p className="text-sm text-gray-500">
              Istoricul este afișat pentru șantierul selectat.
            </p>
          </div>

          {groupedHistory.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nu există istoric pentru acest șantier.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedHistory.map((workerGroup) => (
                <div
                  key={workerGroup.worker_id}
                  className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4"
                >
                  <p className="text-base font-semibold text-gray-900">
                    {workerGroup.worker_name}
                  </p>

                  <div className="mt-4 space-y-3">
                    {workerGroup.rows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                      >
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Data
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {new Date(row.work_date).toLocaleDateString("ro-RO")}
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
                              {[row.is_saturday ? "Sâmbătă" : null, row.is_sunday ? "Duminică" : null]
                                .filter(Boolean)
                                .join(", ") || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Valoare
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {Number(row.total_value || 0).toFixed(2)} lei
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Detaliu
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              Extra {Number(row.extra_hours_value || 0).toFixed(2)} / Weekend {Number(row.weekend_value || 0).toFixed(2)}
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
      </main>
    </div>
  );
}