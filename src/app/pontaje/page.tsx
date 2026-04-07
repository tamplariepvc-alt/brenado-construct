"use client";

import { useEffect, useState } from "react";
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

export default function PontajePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const loadData = async () => {
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
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, project_location, status")
          .order("created_at", { ascending: false });

        if (!projectsError && projectsData) {
          setProjects(projectsData as Project[]);
        }
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects, error: linkedError } = await supabase
          .from("project_team_leads")
          .select("project_id")
          .eq("user_id", user.id);

        if (!linkedError && linkedProjects) {
          const projectIds = linkedProjects.map((item) => item.project_id);

          if (projectIds.length > 0) {
            const { data: projectsData, error: projectsError } = await supabase
              .from("projects")
              .select("id, name, beneficiary, project_location, status")
              .in("id", projectIds)
              .order("created_at", { ascending: false });

            if (!projectsError && projectsData) {
              setProjects(projectsData as Project[]);
            }
          }
        }
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const getStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getStatusClasses = (status: string) => {
    if (status === "in_asteptare") {
      return "bg-yellow-100 text-yellow-700";
    }
    if (status === "in_lucru") {
      return "bg-[#0196ff]/10 text-[#0196ff]";
    }
    if (status === "finalizat") {
      return "bg-green-100 text-green-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="p-6">Se încarcă șantierele pentru pontaj...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pontaje</h1>
            <p className="text-sm text-gray-600">
              Selectează șantierul pentru pontarea echipei.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la dashboard
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Nu există șantiere disponibile pentru pontaj.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl bg-white p-5 shadow"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{project.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {project.beneficiary || "-"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      project.status
                    )}`}
                  >
                    {getStatusLabel(project.status)}
                  </span>
                </div>

                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-500">Locație</p>
                  <p className="mt-1 text-sm font-medium">
                    {project.project_location || "-"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/pontaje/${project.id}`)}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Pontează echipa la intrare
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}