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

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

export default function PontajePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const todayDate = useMemo(() => getTodayDate(), []);

  useEffect(() => {
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

      if (profileData.role === "administrator") {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, project_location, status")
          .in("id", teamProjectIds)
          .order("created_at", { ascending: false });

        if (!projectsError && projectsData) {
          setProjects(projectsData as Project[]);
        } else {
          setProjects([]);
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
          setProjects(projectsData as Project[]);
        } else {
          setProjects([]);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [router, todayDate]);

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

  const renderPontajIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <rect
        x="5"
        y="4"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
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
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderPontajIcon()}
            </div>

            <div>
              <p className="text-sm text-gray-500">Pontaje zilnice</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Pontaje
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Selectează șantierul pentru pontarea echipei de azi.
              </p>
              <p className="mt-2 text-sm font-medium text-gray-400">
                {profile?.full_name} • {new Date(todayDate).toLocaleDateString("ro-RO")}
              </p>
            </div>
          </div>
        </section>

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/pontaje/${project.id}`)}
                  className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
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
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        project.status
                      )}`}
                    >
                      {getStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                      Locație
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-700">
                      {project.project_location || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white">
                    Pontează echipa la intrare
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}