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

  // 👇 ce card e deschis
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  // 👇 ce tip de pontaj e selectat
  const [activeMode, setActiveMode] = useState<
    "normal" | "extra" | "weekend" | null
  >(null);

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (!profileData) {
        router.push("/login");
        return;
      }

      setProfile(profileData as Profile);

      const { data: dailyTeamsData } = await supabase
        .from("daily_teams")
        .select("project_id")
        .eq("work_date", todayDate);

      const ids = Array.from(
        new Set((dailyTeamsData as DailyTeam[]).map((d) => d.project_id))
      );

      if (ids.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, beneficiary, project_location, status")
        .in("id", ids);

      setProjects((projectsData as Project[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router, todayDate]);

  const toggleProject = (id: string) => {
    if (openProjectId === id) {
      setOpenProjectId(null);
      setActiveMode(null);
    } else {
      setOpenProjectId(id);
      setActiveMode(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-[#0196ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Image src="/logo.png" alt="Logo" width={140} height={44} />
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Înapoi
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {projects.length === 0 ? (
          <div className="rounded-xl bg-white p-5">
            Nu există șantiere azi
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[22px] border bg-white p-5"
              >
                {/* HEADER CARD */}
                <div
                  onClick={() => toggleProject(project.id)}
                  className="cursor-pointer"
                >
                  <h2 className="text-lg font-bold">{project.name}</h2>
                  <p className="text-sm text-gray-500">
                    {project.beneficiary}
                  </p>
                </div>

                {/* BUTOANE */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setOpenProjectId(project.id);
                      setActiveMode("normal");
                    }}
                    className="rounded-xl bg-green-600 py-2 text-white text-sm"
                  >
                    Pontează
                  </button>

                  <button
                    onClick={() => {
                      setOpenProjectId(project.id);
                      setActiveMode("extra");
                    }}
                    className="rounded-xl bg-orange-500 py-2 text-white text-sm"
                  >
                    Ore extra
                  </button>

                  <button
                    onClick={() => {
                      setOpenProjectId(project.id);
                      setActiveMode("weekend");
                    }}
                    className="rounded-xl bg-purple-600 py-2 text-white text-sm"
                  >
                    Weekend
                  </button>
                </div>

                {/* ZONA EXPANDATA */}
                {openProjectId === project.id && activeMode && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    {activeMode === "normal" && (
                      <p>Pontaj normal echipă (formular aici)</p>
                    )}

                    {activeMode === "extra" && (
                      <p>Introdu ore extra (formular aici)</p>
                    )}

                    {activeMode === "weekend" && (
                      <p>Pontaj weekend (formular aici)</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}