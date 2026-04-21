"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();

  const [team, setTeam] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: teamData } = await supabase
        .from("daily_teams")
        .select("*")
        .eq("id", id)
        .single();

      if (!teamData) return;

      setTeam(teamData);

      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("id", teamData.project_id)
        .single();

      setProject(projectData);

      const { data: relVeh } = await supabase
        .from("daily_team_vehicles")
        .select("*")
        .eq("daily_team_id", id);

      const { data: relWork } = await supabase
        .from("daily_team_workers")
        .select("*")
        .eq("daily_team_id", id);

      const vehicleIds = relVeh?.map((v) => v.vehicle_id) || [];
      const workerIds = relWork?.map((w) => w.worker_id) || [];

      const { data: vehData } = await supabase
        .from("vehicles")
        .select("*")
        .in("id", vehicleIds);

      const { data: workData } = await supabase
        .from("workers")
        .select("*")
        .in("id", workerIds);

      setVehicles(vehData || []);
      setWorkers(workData || []);
    };

    load();
  }, [id]);

  if (!team) return <div className="p-6">Se incarca...</div>;

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => router.push("/organizarea-echipelor")}
        className="border px-4 py-2 rounded"
      >
        Inapoi
      </button>

      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="font-semibold text-lg">
          {project?.name || "-"}
        </h2>

        <p>Data: {team.work_date}</p>
        <p>Beneficiar: {project?.beneficiary || "-"}</p>
        <p>Locatie: {project?.project_location || "-"}</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-2">Auto atribuite</h3>

        {vehicles.length === 0
          ? "-"
          : vehicles.map((v) => (
              <div key={v.id}>
                {v.registration_number} - {v.brand} {v.model}
              </div>
            ))}
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-2">Muncitori</h3>

        {workers.length === 0
          ? "-"
          : workers.map((w) => (
              <div key={w.id}>{w.full_name}</div>
            ))}
      </div>
    </div>
  );
}