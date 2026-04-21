"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function DetaliuEchipaPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const [allTeamsForDate, setAllTeamsForDate] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teamVehicles, setTeamVehicles] = useState<TeamVehicleRelation[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<TeamWorkerRelation[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const isAdmin = profile?.role === "administrator";

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
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const rca = parseDate(vehicle.rca_valid_until);
    const itp = parseDate(vehicle.itp_valid_until);

    if ((rca && rca < todayOnly) || (itp && itp < todayOnly)) {
      return "doc_expirate";
    }

    return vehicle.status;
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

    const { data: teamData, error: teamError } = await supabase
      .from("daily_teams")
      .select("id, project_id, work_date, created_by, created_at")
      .eq("id", teamId)
      .single();

    if (teamError || !teamData) {
      router.push("/organizarea-echipelor");
      return;
    }

    const workDate = teamData.work_date;

    const [
      allTeamsRes,
      projectsRes,
      vehiclesRes,
      workersRes,
      teamVehiclesRes,
      teamWorkersRes,
    ] = await Promise.all([
      supabase
        .from("daily_teams")
        .select("id, project_id, work_date, created_by, created_at")
        .eq("work_date", workDate),

      supabase
        .from("projects")
        .select("id, name, status, beneficiary, project_location")
        .eq("status", "in_lucru")
        .order("name", { ascending: true }),

      supabase
        .from("vehicles")
        .select("id, brand, model, registration_number, status, rca_valid_until, itp_valid_until")
        .order("registration_number", { ascending: true }),

      supabase
        .from("workers")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),

      supabase
        .from("daily_team_vehicles")
        .select("id, daily_team_id, vehicle_id"),

      supabase
        .from("daily_team_workers")
        .select("id, daily_team_id, worker_id"),
    ]);

    const projectsList = (projectsRes.data as Project[]) || [];
    const vehiclesList = (vehiclesRes.data as Vehicle[]) || [];
    const workersList = (workersRes.data as Worker[]) || [];
    const teamVehiclesList = (teamVehiclesRes.data as TeamVehicleRelation[]) || [];
    const teamWorkersList = (teamWorkersRes.data as TeamWorkerRelation[]) || [];

    setProfile(profileData as Profile);
    setTeam(teamData as Team);
    setProject(
      projectsList.find((item) => item.id === teamData.project_id) || null
    );
    setAllTeamsForDate((allTeamsRes.data as Team[]) || []);
    setProjects(projectsList);
    setVehicles(vehiclesList);
    setWorkers(workersList);
    setTeamVehicles(teamVehiclesList);
    setTeamWorkers(teamWorkersList);

    setSelectedProjectId(teamData.project_id);
    setSelectedVehicleIds(
      teamVehiclesList
        .filter((item) => item.daily_team_id === teamData.id)
        .map((item) => item.vehicle_id)
    );
    setSelectedWorkerIds(
      teamWorkersList
        .filter((item) => item.daily_team_id === teamData.id)
        .map((item) => item.worker_id)
    );

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [teamId]);

  const usedProjectIds = useMemo(() => {
    return allTeamsForDate
      .filter((item) => item.id !== teamId)
      .map((item) => item.project_id);
  }, [allTeamsForDate, teamId]);

  const usedVehicleIds = useMemo(() => {
    return teamVehicles
      .filter((item) => item.daily_team_id !== teamId)
      .map((item) => item.vehicle_id);
  }, [teamVehicles, teamId]);

  const usedWorkerIds = useMemo(() => {
    return teamWorkers
      .filter((item) => item.daily_team_id !== teamId)
      .map((item) => item.worker_id);
  }, [teamWorkers, teamId]);

  const availableProjects = useMemo(() => {
    return projects.filter((item) => {
      if (item.id === selectedProjectId) return true;
      return !usedProjectIds.includes(item.id);
    });
  }, [projects, usedProjectIds, selectedProjectId]);

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

  const handleSave = async () => {
    if (!team) return;

    if (!selectedProjectId) {
      alert("Selecteaza santierul.");
      return;
    }

    if (selectedVehicleIds.length === 0) {
      alert("Selecteaza cel putin un autoturism.");
      return;
    }

    if (selectedWorkerIds.length === 0) {
      alert("Selecteaza cel putin un muncitor.");
      return;
    }

    setSaving(true);

    const { error: updateTeamError } = await supabase
      .from("daily_teams")
      .update({
        project_id: selectedProjectId,
      })
      .eq("id", team.id);

    if (updateTeamError) {
      alert(`A aparut o eroare la actualizarea echipei: ${updateTeamError.message}`);
      setSaving(false);
      return;
    }

    const { error: deleteWorkersError } = await supabase
      .from("daily_team_workers")
      .delete()
      .eq("daily_team_id", team.id);

    if (deleteWorkersError) {
      alert(`A aparut o eroare la actualizarea muncitorilor: ${deleteWorkersError.message}`);
      setSaving(false);
      return;
    }

    const { error: deleteVehiclesError } = await supabase
      .from("daily_team_vehicles")
      .delete()
      .eq("daily_team_id", team.id);

    if (deleteVehiclesError) {
      alert(`A aparut o eroare la actualizarea masinilor: ${deleteVehiclesError.message}`);
      setSaving(false);
      return;
    }

    const workerRows = selectedWorkerIds.map((workerId) => ({
      daily_team_id: team.id,
      worker_id: workerId,
    }));

    const vehicleRows = selectedVehicleIds.map((vehicleId) => ({
      daily_team_id: team.id,
      vehicle_id: vehicleId,
    }));

    const { error: insertWorkersError } = await supabase
      .from("daily_team_workers")
      .insert(workerRows);

    if (insertWorkersError) {
      alert(`A aparut o eroare la salvarea muncitorilor: ${insertWorkersError.message}`);
      setSaving(false);
      return;
    }

    const { error: insertVehiclesError } = await supabase
      .from("daily_team_vehicles")
      .insert(vehicleRows);

    if (insertVehiclesError) {
      alert(`A aparut o eroare la salvarea masinilor: ${insertVehiclesError.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowEditModal(false);
    await loadData();
  };

  const currentTeamVehicleIds = team
    ? teamVehicles
        .filter((item) => item.daily_team_id === team.id)
        .map((item) => item.vehicle_id)
    : [];

  const currentTeamWorkerIds = team
    ? teamWorkers
        .filter((item) => item.daily_team_id === team.id)
        .map((item) => item.worker_id)
    : [];

  const currentVehicles = vehicles.filter((vehicle) =>
    currentTeamVehicleIds.includes(vehicle.id)
  );

  const currentWorkers = workers.filter((worker) =>
    currentTeamWorkerIds.includes(worker.id)
  );

  if (loading) {
    return <div className="p-6">Se incarca echipa...</div>;
  }

  if (!team) {
    return <div className="p-6">Echipa nu a fost gasita.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu echipa</h1>
            <p className="text-sm text-gray-600">
              Vezi componenta echipei planificate pentru{" "}
              {formatDate(team.work_date)}.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/organizarea-echipelor")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Inapoi la echipe
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
              >
                Editeaza echipa
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {project?.name || "-"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Data echipei: {formatDate(team.work_date)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">Beneficiar</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {project?.beneficiary || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">Locatie</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {project?.project_location || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">Muncitori</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {currentWorkers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Auto atribuite</h2>
              <p className="mt-1 text-sm text-gray-500">
                Vehiculele alocate acestei echipe.
              </p>
            </div>

            {currentVehicles.length === 0 ? (
              <p className="text-sm text-gray-500">Nu exista auto atribuite.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {currentVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {vehicle.registration_number}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {vehicle.brand} {vehicle.model}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Muncitori echipa</h2>
              <p className="mt-1 text-sm text-gray-500">
                Toti muncitorii alocati acestei echipe.
              </p>
            </div>

            {currentWorkers.length === 0 ? (
              <p className="text-sm text-gray-500">Nu exista muncitori in echipa.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {currentWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-gray-800">
                      {worker.full_name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Editeaza echipa</h2>
                <p className="text-sm text-gray-500">
                  Modifica santierul, masinile si muncitorii pentru aceasta echipa.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Inchide
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Selectare santier
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="">Alege santier</option>
                    {availableProjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Selectare autoturism
                  </p>

                  {availableVehicles.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu exista masini disponibile.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableVehicles.map((vehicle) => (
                        <label
                          key={vehicle.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
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
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu exista muncitori disponibili.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableWorkers.map((worker) => (
                        <label
                          key={worker.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
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

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-800">
                    Santier selectat:{" "}
                    {availableProjects.find((p) => p.id === selectedProjectId)?.name || "-"}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Auto selectate: {selectedVehicleIds.length}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Muncitori selectati: {selectedWorkerIds.length}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Se salveaza..." : "Salveaza modificarile"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    Renunta
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