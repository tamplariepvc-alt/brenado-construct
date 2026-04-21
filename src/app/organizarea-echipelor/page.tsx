"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Team = {
  id: string;
  project_id: string;
  work_date: string;
};

type Project = {
  id: string;
  name: string;
  project_location: string | null;
};

type RelationVehicle = {
  daily_team_id: string;
  vehicle_id: string;
};

type RelationWorker = {
  daily_team_id: string;
  worker_id: string;
};

type Vehicle = {
  id: string;
  registration_number: string;
};

export default function Page() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [relVehicles, setRelVehicles] = useState<RelationVehicle[]>([]);
  const [relWorkers, setRelWorkers] = useState<RelationWorker[]>([]);

  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    const load = async () => {
      const tomorrow = getTomorrow();

      const [teamsRes, projectsRes, vehiclesRes, relVehRes, relWorkRes] =
        await Promise.all([
          supabase.from("daily_teams").select("*").eq("work_date", tomorrow),
          supabase.from("projects").select("id,name,project_location"),
          supabase.from("vehicles").select("id,registration_number"),
          supabase.from("daily_team_vehicles").select("*"),
          supabase.from("daily_team_workers").select("*"),
        ]);

      setTeams((teamsRes.data as Team[]) || []);
      setProjects((projectsRes.data as Project[]) || []);
      setVehicles((vehiclesRes.data as Vehicle[]) || []);
      setRelVehicles((relVehRes.data as RelationVehicle[]) || []);
      setRelWorkers((relWorkRes.data as RelationWorker[]) || []);
    };

    load();
  }, []);

  const getProject = (id: string) =>
    projects.find((p) => p.id === id);

  const getVehiclesPreview = (teamId: string) => {
    const ids = relVehicles
      .filter((r) => r.daily_team_id === teamId)
      .map((r) => r.vehicle_id);

    if (ids.length === 0) return "-";

    const regs = ids
      .map((id) => vehicles.find((v) => v.id === id)?.registration_number)
      .filter(Boolean);

    if (regs.length === 1) return regs[0];

    return `${regs[0]} +${regs.length - 1}`;
  };

  const getWorkersCount = (teamId: string) =>
    relWorkers.filter((r) => r.daily_team_id === teamId).length;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Organizarea echipelor</h1>

      <div className="grid gap-4">
        {teams.map((team, index) => {
          const project = getProject(team.project_id);

          return (
            <div
              key={team.id}
              onClick={() =>
                router.push(`/organizarea-echipelor/${team.id}`)
              }
              className="bg-white p-4 rounded-xl shadow cursor-pointer"
            >
              <h2 className="font-semibold">Echipa {index + 1}</h2>

              <p className="text-sm text-gray-500">
                {project?.name || "-"}
              </p>

              <p className="text-sm mt-2">
                Auto: {getVehiclesPreview(team.id)}
              </p>

              <p className="text-sm">
                Muncitori: {getWorkersCount(team.id)}
              </p>

              <p className="text-sm">
                Locatie: {project?.project_location || "-"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}