"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type ProjectStats = {
  total: number;
  inCurs: number;
  finalizate: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    inCurs: 0,
    finalizate: 0,
  });

  useEffect(() => {
    const loadDashboard = async () => {
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

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, status");

      if (!projectsError && projectsData) {
        const total = projectsData.length;
const inCurs = projectsData.filter(
  (project) => project.status === "in_lucru"
).length;
        const finalizate = projectsData.filter(
          (project) => project.status === "finalizat"
        ).length;

        setStats({
          total,
          inCurs,
          finalizate,
        });
      }

      setProfile(profileData as Profile);
      setLoading(false);
    };

    loadDashboard();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="p-8 text-lg font-medium">
        Se încarcă dashboard-ul...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-600 px-4 py-2 text-white"
        >
          Ieșire
        </button>

<div className="flex justify-center">
  <Image
    src="/logo.png"
    alt="Logo"
    width={140}
    height={50}
    className="object-contain"
  />
</div>

        <button className="relative rounded-full border px-3 py-2 text-xl">
          🔔
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500"></span>
        </button>
      </header>

<main className="p-6">
  <h1 className="mb-2 text-2xl font-bold">
    Bun venit, {profile?.full_name}
  </h1>
  <p className="mb-6 text-gray-600">
    Rol: <span className="font-semibold">{profile?.role}</span>
  </p>

  {profile?.role === "administrator" && (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        onClick={() => router.push("/proiecte/adauga")}
        className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow"
      >
        ADAUGĂ PROIECT
      </button>

      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        VEZI PROIECTE
      </button>

      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        COMENZI
      </button>

      <button
        onClick={() => router.push("/admin")}
        className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-left text-white shadow"
      >
        PANOU ADMINISTRATOR
      </button>
    </div>
  )}

  {profile?.role === "sef_echipa" && (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        PROIECTELE MELE
      </button>

      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        COMENZI
      </button>

      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        CERERE TRANSFER DE BANI
      </button>
    </div>
  )}

  {profile?.role === "user" && (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        DASHBOARD USER
      </button>

      <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-left shadow">
        VEZI PROIECTE
      </button>
    </div>
  )}

<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
  
  {/* TOTAL PROIECTE */}
  <div className="rounded-xl px-4 py-3 shadow text-white" style={{ backgroundColor: "#0196ff" }}>
    <p className="text-xs opacity-90">TOTAL PROIECTE</p>
    <p className="mt-1 text-xl font-bold">{stats.total}</p>
  </div>

  {/* PROIECTE IN CURS */}
  <div className="rounded-xl px-4 py-3 shadow text-white bg-orange-500">
    <p className="text-xs opacity-90">PROIECTE ÎN CURS</p>
    <p className="mt-1 text-xl font-bold">{stats.inCurs}</p>
  </div>

  {/* FINALIZATE */}
  <div className="rounded-xl px-4 py-3 shadow text-white bg-green-600">
    <p className="text-xs opacity-90">PROIECTE FINALIZATE</p>
    <p className="mt-1 text-xl font-bold">{stats.finalizate}</p>
  </div>
  </div>
</main>
    </div>
  );
}