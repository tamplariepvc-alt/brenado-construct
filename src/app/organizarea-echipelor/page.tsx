"use client";

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
  vehicle_id: string;
  vehicles?: {
    id: string;
    brand: string;
    model: string;
    registration_number: string;
  }[] | null;
};

type TeamWorkerRelation = {
  worker_id: string;
  workers?: {
    id: string;
    full_name: string;
  }[] | null;
};

type TeamRow = {
  id: string;
  project_id: string;
  work_date: string;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    beneficiary: string | null;
    project_location: string | null;
  }[] | null;
  daily_team_workers?: TeamWorkerRelation[] | null;
  daily_team_vehicles?: TeamVehicleRelation[] | null;
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
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const tomorrowDate = useMemo(() => getTomorrowDate(), []);
  const isAdmin = profile?.role === "administrator";

  const resetForm = () => {
    setSelectedProjectId("");
    setSelectedVehicleIds([]);
    setSelectedWorkerIds([]);
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

  const getVehicleComputedStatus = (vehicle: Vehicle) => {
    const today = new Date();
    const rca = vehicle.rca_valid_until ? parseDate(vehicle.rca_valid_until) : null;
    const itp = vehicle.itp_valid_until ? parseDate(vehicle.itp_valid_until) : null;

    if ((rca && rca < today) || (itp && itp < today)) {
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

    const [teamsRes, projectsRes, vehiclesRes, workersRes] = await Promise.all([
      supabase
        .from("daily_teams")
        .select(`
          id,
          project_id,
          work_date,
          created_at,
          projects:project_id (
            id,
            name,
            beneficiary,
            project_location
          ),
          daily_team_workers (
            worker_id,
            workers:worker_id (
              id,
              full_name
            )
          ),
          daily_team_vehicles (
            vehicle_id,
            vehicles:vehicle_id (
              id,
              brand,
              model,
              registration_number
            )
          )
        `)
        .eq("work_date", tomorrowDate)
        .order("created_at", { ascending: true }),

      supabase
        .from("projects")
        .select("id, name, status, beneficiary, project_location")
        .eq("status", "in_lucru")
        .order("name", { ascending: true }),

      supabase
        .from("vehicles")
        .select(`
          id,
          brand,
          model,
          registration_number,
          status,
          rca_valid_until,
          itp_valid_until
        `)
        .order("registration_number", { ascending: true }),

      supabase
        .from("workers")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

    setProfile(profileData as Profile);
    setTeams((teamsRes.data as unknown as TeamRow[]) || []);
    setProjects((projectsRes.data as Project[]) || []);
    setVehicles((vehiclesRes.data as Vehicle[]) || []);
    setWorkers((workersRes.data as Worker[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const usedProjectIds = useMemo(() => {
    return teams.map((team) => team.project_id);
  }, [teams]);

  const usedVehicleIds = useMemo(() => {
    return teams.flatMap((team) =>
      (team.daily_team_vehicles || []).map((item) => item.vehicle_id)
    );
  }, [teams]);

  const usedWorkerIds = useMemo(() => {
    return teams.flatMap((team) =>
      (team.daily_team_workers || []).map((item) => item.worker_id)
    );
  }, [teams]);

  const availableProjects = useMemo(() => {
    if (!editingTeamId) {
      return projects.filter((project) => !usedProjectIds.includes(project.id));
    }

    const editingTeam = teams.find((team) => team.id === editingTeamId);

    return projects.filter((project) => {
      if (project.id === editingTeam?.project_id) return true;
      return !usedProjectIds.includes(project.id);
    });
  }, [projects, usedProjectIds, editingTeamId, teams]);

  const availableVehicles = useMemo(() => {
    const validVehicles = vehicles.filter(
      (vehicle) => getVehicleComputedStatus(vehicle) !== "doc_expirate"
    );

    if (!editingTeamId) {
      return validVehicles.filter((vehicle) => !usedVehicleIds.includes(vehicle.id));
    }

    const editingTeam = teams.find((team) => team.id === editingTeamId);
    const editingVehicleIds = (editingTeam?.daily_team_vehicles || []).map(
      (item) => item.vehicle_id
    );

    return validVehicles.filter((vehicle) => {
      if (editingVehicleIds.includes(vehicle.id)) return true;
      return !usedVehicleIds.includes(vehicle.id);
    });
  }, [vehicles, usedVehicleIds, editingTeamId, teams]);

  const availableWorkers = useMemo(() => {
    if (!editingTeamId) {
      return workers.filter((worker) => !usedWorkerIds.includes(worker.id));
    }

    const editingTeam = teams.find((team) => team.id === editingTeamId);
    const editingWorkerIds = (editingTeam?.daily_team_workers || []).map(
      (item) => item.worker_id
    );

    return workers.filter((worker) => {
      if (editingWorkerIds.includes(worker.id)) return true;
      return !usedWorkerIds.includes(worker.id);
    });
  }, [workers, usedWorkerIds, editingTeamId, teams]);

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
    setShowCreateModal(true);
  };

  const openEditModal = (team: TeamRow) => {
    setEditingTeamId(team.id);
    setSelectedProjectId(team.project_id);
    setSelectedVehicleIds(
      (team.daily_team_vehicles || []).map((item) => item.vehicle_id)
    );
    setSelectedWorkerIds(
      (team.daily_team_workers || []).map((item) => item.worker_id)
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

    if (!editingTeamId) {
      const { data: teamInsert, error: teamError } = await supabase
        .from("daily_teams")
        .insert({
          project_id: selectedProjectId,
          work_date: tomorrowDate,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (teamError || !teamInsert) {
        alert(`A aparut o eroare la crearea echipei: ${teamError?.message || ""}`);
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
        alert(`A aparut o eroare la salvarea muncitorilor: ${workerError.message}`);
        setSaving(false);
        return;
      }

      const { error: vehicleError } = await supabase
        .from("daily_team_vehicles")
        .insert(vehicleRows);

      if (vehicleError) {
        alert(`A aparut o eroare la salvarea masinilor: ${vehicleError.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: updateTeamError } = await supabase
        .from("daily_teams")
        .update({
          project_id: selectedProjectId,
        })
        .eq("id", editingTeamId);

      if (updateTeamError) {
        alert(`A aparut o eroare la actualizarea echipei: ${updateTeamError.message}`);
        setSaving(false);
        return;
      }

      const { error: deleteWorkersError } = await supabase
        .from("daily_team_workers")
        .delete()
        .eq("daily_team_id", editingTeamId);

      if (deleteWorkersError) {
        alert(`A aparut o eroare la actualizarea muncitorilor: ${deleteWorkersError.message}`);
        setSaving(false);
        return;
      }

      const { error: deleteVehiclesError } = await supabase
        .from("daily_team_vehicles")
        .delete()
        .eq("daily_team_id", editingTeamId);

      if (deleteVehiclesError) {
        alert(`A aparut o eroare la actualizarea masinilor: ${deleteVehiclesError.message}`);
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
    }

    setSaving(false);
    closeCreateModal();
    await loadData();
  };

  const getProjectName = (team: TeamRow) => {
    return team.projects?.[0]?.name || "Proiect";
  };

  const getProjectLocation = (team: TeamRow) => {
    return team.projects?.[0]?.project_location || "-";
  };

  const getVehiclesPreview = (team: TeamRow) => {
    const vehiclesList = (team.daily_team_vehicles || [])
      .map((item) => item.vehicles?.[0]?.registration_number || "-")
      .filter(Boolean);

    if (vehiclesList.length === 0) return "-";
    if (vehiclesList.length === 1) return vehiclesList[0];

    return `${vehiclesList[0]} +${vehiclesList.length - 1}`;
  };

  if (loading) {
    return <div className="p-6">Se incarca organizarea echipelor...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organizarea echipelor</h1>
            <p className="text-sm text-gray-600">
              Echipe planificate pentru ziua urmatoare:{" "}
              <span className="font-semibold">
                {new Date(`${tomorrowDate}T00:00:00`).toLocaleDateString("ro-RO")}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Inapoi la dashboard
            </button>

            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
              >
                Creeaza echipa
              </button>
            )}
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Nu exista echipe postate pentru ziua urmatoare.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team, index) => (
              <button
                key={team.id}
                type="button"
                onClick={() => router.push(`/organizarea-echipelor/${team.id}`)}
                className="rounded-2xl bg-white p-5 text-left shadow transition hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Echipa {index + 1}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {getProjectName(team)}
                    </p>
                  </div>

                  <div className="text-3xl font-light text-gray-400">›</div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium text-gray-500">Auto atribuite:</span>{" "}
                    {getVehiclesPreview(team)}
                  </p>

                  <p className="text-gray-700">
                    <span className="font-medium text-gray-500">Muncitori echipa:</span>{" "}
                    {(team.daily_team_workers || []).length}
                  </p>

                  <p className="text-gray-700">
                    <span className="font-medium text-gray-500">Locatie:</span>{" "}
                    {getProjectLocation(team)}
                  </p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(team);
                    }}
                    className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                  >
                    Editeaza
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingTeamId ? "Editeaza echipa" : "Creeaza echipa"}
                </h2>
                <p className="text-sm text-gray-500">
                  Echipa se va salva pentru data de{" "}
                  {new Date(`${tomorrowDate}T00:00:00`).toLocaleDateString("ro-RO")}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
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
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu exista masini disponibile pentru ziua urmatoare.
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
                      Nu exista muncitori disponibili pentru ziua urmatoare.
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
                    onClick={handleSaveTeam}
                    disabled={saving}
                    className="w-full rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving
                      ? "Se salveaza..."
                      : editingTeamId
                      ? "Salveaza modificarile"
                      : "Posteaza echipa"}
                  </button>

                  <button
                    type="button"
                    onClick={closeCreateModal}
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