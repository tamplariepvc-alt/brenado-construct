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

type Team = {
  id: string;
  project_id: string;
  work_date: string;
  created_by?: string | null;
  created_at?: string | null;
};

type Project = {
  id: string;
  name: string;
  status: string;
  beneficiary: string | null;
  project_location: string | null;
};

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  registration_number: string;
  status: string;
  rca_valid_until: string | null;
  itp_valid_until: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type TeamVehicleRelation = {
  id?: string;
  daily_team_id: string;
  vehicle_id: string;
};

type TeamWorkerRelation = {
  id?: string;
  daily_team_id: string;
  worker_id: string;
};

type ModalDateTeam = {
  id: string;
  project_id: string;
  work_date: string;
};

type ModalDateTeamVehicleRelation = {
  daily_team_id: string;
  vehicle_id: string;
};

type ModalDateTeamWorkerRelation = {
  daily_team_id: string;
  worker_id: string;
};

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const getTomorrowDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function OrganizareaEchipelorPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teamVehicles, setTeamVehicles] = useState<TeamVehicleRelation[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<TeamWorkerRelation[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedWorkDate, setSelectedWorkDate] = useState(getTomorrowDate());

  const [modalTeamsForDate, setModalTeamsForDate] = useState<ModalDateTeam[]>(
    []
  );
  const [modalTeamVehiclesForDate, setModalTeamVehiclesForDate] = useState<
    ModalDateTeamVehicleRelation[]
  >([]);
  const [modalTeamWorkersForDate, setModalTeamWorkersForDate] = useState<
    ModalDateTeamWorkerRelation[]
  >([]);

  const todayDate = useMemo(() => getTodayDate(), []);
  const tomorrowDate = useMemo(() => getTomorrowDate(), []);
  const [selectedViewDate, setSelectedViewDate] = useState(getTomorrowDate());

  const isAdmin = profile?.role === "administrator";

  const resetForm = () => {
    setSelectedProjectId("");
    setSelectedVehicleIds([]);
    setSelectedWorkerIds([]);
    setSelectedWorkDate(getTomorrowDate());
    setEditingTeamId(null);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const parseDate = (value: string | null | undefined) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (date: string) => {
    return new Date(`${date}T00:00:00`).toLocaleDateString("ro-RO");
  };

  const getVehicleComputedStatus = (vehicle: Vehicle) => {
    const today = new Date();
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const rca = parseDate(vehicle.rca_valid_until);
    const itp = parseDate(vehicle.itp_valid_until);

    if ((rca && rca < todayOnly) || (itp && itp < todayOnly)) {
      return "doc_expirate";
    }

    return vehicle.status;
  };

  const loadModalAvailabilityForDate = async (workDate: string) => {
    const { data: teamsData } = await supabase
      .from("daily_teams")
      .select("id, project_id, work_date")
      .eq("work_date", workDate);

    const parsedTeams = (teamsData as ModalDateTeam[]) || [];
    setModalTeamsForDate(parsedTeams);

    const teamIds = parsedTeams.map((team) => team.id);

    if (teamIds.length === 0) {
      setModalTeamVehiclesForDate([]);
      setModalTeamWorkersForDate([]);
      return;
    }

    const [{ data: vehiclesData }, { data: workersData }] = await Promise.all([
      supabase
        .from("daily_team_vehicles")
        .select("daily_team_id, vehicle_id")
        .in("daily_team_id", teamIds),

      supabase
        .from("daily_team_workers")
        .select("daily_team_id, worker_id")
        .in("daily_team_id", teamIds),
    ]);

    setModalTeamVehiclesForDate(
      (vehiclesData as ModalDateTeamVehicleRelation[]) || []
    );
    setModalTeamWorkersForDate(
      (workersData as ModalDateTeamWorkerRelation[]) || []
    );
  };

  const loadData = async () => {
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

    const [
      teamsRes,
      projectsRes,
      vehiclesRes,
      workersRes,
      teamVehiclesRes,
      teamWorkersRes,
    ] = await Promise.all([
      supabase
        .from("daily_teams")
        .select("id, project_id, work_date, created_by, created_at")
        .eq("work_date", selectedViewDate)
        .order("created_at", { ascending: true }),

      supabase
        .from("projects")
        .select("id, name, status, beneficiary, project_location")
        .eq("status", "in_lucru")
        .order("name", { ascending: true }),

      supabase
        .from("vehicles")
        .select(
          "id, brand, model, registration_number, status, rca_valid_until, itp_valid_until"
        )
        .order("registration_number", { ascending: true }),

      supabase
        .from("workers")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),

      supabase.from("daily_team_vehicles").select("id, daily_team_id, vehicle_id"),

      supabase.from("daily_team_workers").select("id, daily_team_id, worker_id"),
    ]);

    setProfile(profileData as Profile);
    setTeams((teamsRes.data as Team[]) || []);
    setProjects((projectsRes.data as Project[]) || []);
    setVehicles((vehiclesRes.data as Vehicle[]) || []);
    setWorkers((workersRes.data as Worker[]) || []);
    setTeamVehicles((teamVehiclesRes.data as TeamVehicleRelation[]) || []);
    setTeamWorkers((teamWorkersRes.data as TeamWorkerRelation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedViewDate]);

  useEffect(() => {
    if (!showCreateModal || !selectedWorkDate) return;
    loadModalAvailabilityForDate(selectedWorkDate);
  }, [showCreateModal, selectedWorkDate]);

  const modalDateTeamIds = useMemo(() => {
    return modalTeamsForDate
      .filter((team) => team.id !== editingTeamId)
      .map((team) => team.id);
  }, [modalTeamsForDate, editingTeamId]);

  const usedProjectIds = useMemo(() => {
    return modalTeamsForDate
      .filter((team) => team.id !== editingTeamId)
      .map((team) => team.project_id);
  }, [modalTeamsForDate, editingTeamId]);

  const usedVehicleIds = useMemo(() => {
    return modalTeamVehiclesForDate
      .filter((item) => modalDateTeamIds.includes(item.daily_team_id))
      .map((item) => item.vehicle_id);
  }, [modalTeamVehiclesForDate, modalDateTeamIds]);

  const usedWorkerIds = useMemo(() => {
    return modalTeamWorkersForDate
      .filter((item) => modalDateTeamIds.includes(item.daily_team_id))
      .map((item) => item.worker_id);
  }, [modalTeamWorkersForDate, modalDateTeamIds]);

  const availableProjects = useMemo(() => {
    return projects.filter((project) => {
      if (editingTeamId && project.id === selectedProjectId) return true;
      return !usedProjectIds.includes(project.id);
    });
  }, [projects, usedProjectIds, editingTeamId, selectedProjectId]);

  const availableVehicles = useMemo(() => {
    return vehicles
      .filter((vehicle) => getVehicleComputedStatus(vehicle) !== "doc_expirate")
      .filter((vehicle) => {
        if (selectedVehicleIds.includes(vehicle.id)) return true;
        return !usedVehicleIds.includes(vehicle.id);
      });
  }, [vehicles, usedVehicleIds, selectedVehicleIds]);

  const availableWorkers = useMemo(() => {
    return workers.filter((worker) => {
      if (selectedWorkerIds.includes(worker.id)) return true;
      return !usedWorkerIds.includes(worker.id);
    });
  }, [workers, usedWorkerIds, selectedWorkerIds]);

  const stats = useMemo(() => {
    return {
      totalTeams: teams.length,
      totalWorkers: teams.reduce(
        (acc, team) =>
          acc +
          teamWorkers.filter((item) => item.daily_team_id === team.id).length,
        0
      ),
      totalVehicles: teams.reduce(
        (acc, team) =>
          acc +
          teamVehicles.filter((item) => item.daily_team_id === team.id).length,
        0
      ),
    };
  }, [teams, teamWorkers, teamVehicles]);

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const openCreateModal = () => {
    resetForm();
    setSelectedWorkDate(getTomorrowDate());
    setShowCreateModal(true);
  };

  const openEditModal = (team: Team) => {
    setEditingTeamId(team.id);
    setSelectedProjectId(team.project_id);
    setSelectedWorkDate(team.work_date);
    setSelectedVehicleIds(
      teamVehicles
        .filter((item) => item.daily_team_id === team.id)
        .map((item) => item.vehicle_id)
    );
    setSelectedWorkerIds(
      teamWorkers
        .filter((item) => item.daily_team_id === team.id)
        .map((item) => item.worker_id)
    );
    setShowCreateModal(true);
  };

  const handleSaveTeam = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedWorkDate) {
      alert("Selectează data echipei.");
      return;
    }

    if (!selectedProjectId) {
      alert("Selectează șantierul.");
      return;
    }

    if (selectedVehicleIds.length === 0) {
      alert("Selectează cel puțin un autoturism.");
      return;
    }

    if (selectedWorkerIds.length === 0) {
      alert("Selectează cel puțin un muncitor.");
      return;
    }

    setSaving(true);

    if (!editingTeamId) {
      const { data: teamInsert, error: teamError } = await supabase
        .from("daily_teams")
        .insert({
          project_id: selectedProjectId,
          work_date: selectedWorkDate,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (teamError || !teamInsert) {
        alert(
          `A apărut o eroare la crearea echipei: ${teamError?.message || ""}`
        );
        setSaving(false);
        return;
      }

      const workerRows = selectedWorkerIds.map((workerId) => ({
        daily_team_id: teamInsert.id,
        worker_id: workerId,
      }));

      const vehicleRows = selectedVehicleIds.map((vehicleId) => ({
        daily_team_id: teamInsert.id,
        vehicle_id: vehicleId,
      }));

      const { error: workerError } = await supabase
        .from("daily_team_workers")
        .insert(workerRows);

      if (workerError) {
        alert(
          `A apărut o eroare la salvarea muncitorilor: ${workerError.message}`
        );
        setSaving(false);
        return;
      }

      const { error: vehicleError } = await supabase
        .from("daily_team_vehicles")
        .insert(vehicleRows);

      if (vehicleError) {
        alert(
          `A apărut o eroare la salvarea mașinilor: ${vehicleError.message}`
        );
        setSaving(false);
        return;
      }
    } else {
      const { error: updateTeamError } = await supabase
        .from("daily_teams")
        .update({
          project_id: selectedProjectId,
          work_date: selectedWorkDate,
        })
        .eq("id", editingTeamId);

      if (updateTeamError) {
        alert(
          `A apărut o eroare la actualizarea echipei: ${updateTeamError.message}`
        );
        setSaving(false);
        return;
      }

      const { error: deleteWorkersError } = await supabase
        .from("daily_team_workers")
        .delete()
        .eq("daily_team_id", editingTeamId);

      if (deleteWorkersError) {
        alert(
          `A apărut o eroare la actualizarea muncitorilor: ${deleteWorkersError.message}`
        );
        setSaving(false);
        return;
      }

      const { error: deleteVehiclesError } = await supabase
        .from("daily_team_vehicles")
        .delete()
        .eq("daily_team_id", editingTeamId);

      if (deleteVehiclesError) {
        alert(
          `A apărut o eroare la actualizarea mașinilor: ${deleteVehiclesError.message}`
        );
        setSaving(false);
        return;
      }

      const workerRows = selectedWorkerIds.map((workerId) => ({
        daily_team_id: editingTeamId,
        worker_id: workerId,
      }));

      const vehicleRows = selectedVehicleIds.map((vehicleId) => ({
        daily_team_id: editingTeamId,
        vehicle_id: vehicleId,
      }));

      const { error: insertWorkersError } = await supabase
        .from("daily_team_workers")
        .insert(workerRows);

      if (insertWorkersError) {
        alert(
          `A apărut o eroare la salvarea muncitorilor: ${insertWorkersError.message}`
        );
        setSaving(false);
        return;
      }

      const { error: insertVehiclesError } = await supabase
        .from("daily_team_vehicles")
        .insert(vehicleRows);

      if (insertVehiclesError) {
        alert(
          `A apărut o eroare la salvarea mașinilor: ${insertVehiclesError.message}`
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeCreateModal();

    if (selectedViewDate !== selectedWorkDate) {
      setSelectedViewDate(selectedWorkDate);
    } else {
      await loadData();
    }
  };

  const getProjectById = (projectId: string) => {
    return projects.find((project) => project.id === projectId) || null;
  };

  const getTeamVehicleIds = (teamId: string) => {
    return teamVehicles
      .filter((item) => item.daily_team_id === teamId)
      .map((item) => item.vehicle_id);
  };

  const getTeamWorkerIds = (teamId: string) => {
    return teamWorkers
      .filter((item) => item.daily_team_id === teamId)
      .map((item) => item.worker_id);
  };

  const getVehiclesPreview = (teamId: string) => {
    const vehicleIds = getTeamVehicleIds(teamId);
    const regs = vehicleIds
      .map(
        (vehicleId) =>
          vehicles.find((vehicle) => vehicle.id === vehicleId)
            ?.registration_number
      )
      .filter(Boolean) as string[];

    if (regs.length === 0) return "-";
    if (regs.length === 1) return regs[0];
    return `${regs[0]} +${regs.length - 1}`;
  };

  const renderTeamIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3.5 18c0-2.8 2.4-5 5.5-5s5.5 2.2 5.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14.5 18c.2-1.8 1.8-3.2 4-3.2 1 0 2 .2 2.8.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

if (loading) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-blue-600">
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la dashboard
            </button>

            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Creează echipă
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderTeamIcon()}
            </div>

            <div className="min-w-0">
              <p className="text-sm text-gray-500">Planificare echipe</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Organizarea echipelor
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                {selectedViewDate === todayDate
                  ? "Echipe planificate pentru azi."
                  : "Echipe planificate pentru ziua următoare."}
              </p>
              <p className="mt-2 text-sm font-medium text-gray-400">
                {formatDate(selectedViewDate)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-blue-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">
                {stats.totalTeams}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Echipe
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">
                {stats.totalWorkers}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">
                Muncitori
              </p>
            </div>

            <div className="rounded-2xl bg-orange-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-orange-600 sm:text-3xl">
                {stats.totalVehicles}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">
                Auto
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => setSelectedViewDate(todayDate)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedViewDate === todayDate
                  ? "bg-black text-white"
                  : "border border-gray-300 bg-white text-gray-700"
              }`}
            >
              Vezi echipele de azi
            </button>

            <button
              onClick={() => setSelectedViewDate(tomorrowDate)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedViewDate === tomorrowDate
                  ? "bg-black text-white"
                  : "border border-gray-300 bg-white text-gray-700"
              }`}
            >
              Vezi echipele de mâine
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Echipe planificate
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {teams.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {selectedViewDate === todayDate
                  ? "Nu există echipe postate pentru azi."
                  : "Nu există echipe postate pentru ziua următoare."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team, index) => {
                const project = getProjectById(team.project_id);
                const workerCount = getTeamWorkerIds(team.id).length;

                return (
                  <div
                    key={team.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/organizarea-echipelor/${team.id}`)}
                      className="w-full text-left"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-gray-900">
                            Echipa {index + 1}
                          </h2>
                          <p className="mt-1 text-sm font-medium text-gray-500">
                            {project?.name || "-"}
                          </p>
                        </div>

                        <div className="text-3xl font-light text-gray-400">›</div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Data</span>
                          <span className="text-right font-medium text-gray-900">
                            {formatDate(team.work_date)}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Auto atribuite</span>
                          <span className="text-right font-medium text-gray-900">
                            {getVehiclesPreview(team.id)}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Muncitori</span>
                          <span className="text-right font-medium text-gray-900">
                            {workerCount}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Locație</span>
                          <span className="text-right font-medium text-gray-900">
                            {project?.project_location || "-"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openEditModal(team)}
                        className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Editează
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingTeamId ? "Editează echipa" : "Creează echipa"}
                </h2>
                <p className="text-sm text-gray-500">
                  Echipa se va salva pentru data de {formatDate(selectedWorkDate)}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Data echipei
                  </label>
                  <input
                    type="date"
                    value={selectedWorkDate}
                    onChange={(e) => setSelectedWorkDate(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Selectare șantier
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="">Alege șantier</option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Selectare autoturism
                  </p>

                  {availableVehicles.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu există mașini disponibile pentru data selectată.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableVehicles.map((vehicle) => (
                        <label
                          key={vehicle.id}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVehicleIds.includes(vehicle.id)}
                            onChange={() => toggleVehicle(vehicle.id)}
                            className="h-5 w-5"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {vehicle.registration_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              {vehicle.brand} {vehicle.model}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Alege echipa
                  </p>

                  {availableWorkers.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu există muncitori disponibili pentru data selectată.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableWorkers.map((worker) => (
                        <label
                          key={worker.id}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorkerIds.includes(worker.id)}
                            onChange={() => toggleWorker(worker.id)}
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-medium text-gray-800">
                            {worker.full_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-800">
                    Data selectată: {formatDate(selectedWorkDate)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-blue-800">
                    Șantier selectat:{" "}
                    {availableProjects.find((p) => p.id === selectedProjectId)
                      ?.name || "-"}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Auto selectate: {selectedVehicleIds.length}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Muncitori selectați: {selectedWorkerIds.length}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveTeam}
                    disabled={saving}
                    className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving
                      ? "Se salvează..."
                      : editingTeamId
                      ? "Salvează modificările"
                      : "Postează echipa"}
                  </button>

                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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