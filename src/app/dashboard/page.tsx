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

type ProjectStats = {
  total: number;
  inCurs: number;
  finalizate: number;
};

type ActiveProject = {
  id: string;
  name: string;
  beneficiary: string | null;
  status: string | null;
  start_date?: string | null;
  execution_deadline?: string | null;
  created_at: string;
};

type QuickAction = {
  label: string;
  sublabel: string;
  route?: string;
  dark?: boolean;
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
  const [projects, setProjects] = useState<ActiveProject[]>([]);

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
        .select(
          "id, name, beneficiary, status, start_date, execution_deadline, created_at"
        )
        .order("created_at", { ascending: false });

      if (!projectsError && projectsData) {
        const parsedProjects = projectsData as ActiveProject[];

        const total = parsedProjects.length;
        const inCurs = parsedProjects.filter(
          (project) => project.status === "in_lucru"
        ).length;
        const finalizate = parsedProjects.filter(
          (project) => project.status === "finalizat"
        ).length;

        setStats({
          total,
          inCurs,
          finalizate,
        });

        setProjects(parsedProjects);
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

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString("ro-RO", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  const getRoleLabel = (role?: Role) => {
    if (role === "administrator") return "Administrator";
    if (role === "sef_echipa") return "Șef de echipă";
    if (role === "user") return "Utilizator";
    return "-";
  };

  const adminActions: QuickAction[] = [
    {
      label: "Adaugă\nProiect",
      sublabel: "Proiect nou",
      route: "/proiecte/adauga",
    },
    {
      label: "Vezi\nProiecte",
      sublabel: `${stats.total} active`,
      route: "/proiecte",
    },
    {
      label: "Comenzi\nMateriale",
      sublabel: "Gestionează",
      route: "/comenzi",
    },
    {
      label: "Pontaje\nEchipe",
      sublabel: "Ore lucrate",
      route: "/pontaje",
    },
    {
      label: "Organizare\nEchipe",
      sublabel: "Planificare",
      route: "/organizarea-echipelor",
    },
    {
      label: "Panou\nAdmin",
      sublabel: "Setări sistem",
      route: "/admin",
      dark: true,
    },
  ];

  const teamLeadActions: QuickAction[] = [
    {
      label: "Proiectele\nMele",
      sublabel: "Șantiere active",
      route: "/proiecte",
    },
    {
      label: "Comenzi\nMateriale",
      sublabel: "Gestionează",
      route: "/comenzi",
    },
    {
      label: "Pontaje\nEchipe",
      sublabel: "Ore lucrate",
      route: "/pontaje",
    },
    {
      label: "Organizare\nEchipe",
      sublabel: "Planificare",
      route: "/organizarea-echipelor",
    },
    {
      label: "Cerere\nTransfer",
      sublabel: "Financiar",
    },
  ];

  const userActions: QuickAction[] = [
    {
      label: "Dashboard\nUser",
      sublabel: "Rezumat",
    },
    {
      label: "Vezi\nProiecte",
      sublabel: "Listă proiecte",
      route: "/proiecte",
    },
    {
      label: "Organizare\nEchipe",
      sublabel: "Programări",
      route: "/organizarea-echipelor",
    },
  ];

  const quickActions =
    profile?.role === "administrator"
      ? adminActions
      : profile?.role === "sef_echipa"
      ? teamLeadActions
      : userActions;

  const activeProjects = useMemo(() => {
    return projects.filter((project) => project.status !== "finalizat");
  }, [projects]);

  const desktopProjects = useMemo(() => {
    return activeProjects.slice(0, 4);
  }, [activeProjects]);

  const mobileProjects = useMemo(() => {
    return activeProjects.slice(0, 6);
  }, [activeProjects]);

  const getProjectPercent = (project: ActiveProject) => {
    if (project.status === "finalizat") return 100;
    if (project.status === "in_asteptare") return 15;
    if (project.status === "in_lucru") return 72;
    return 20;
  };

  const getProjectStatusLabel = (status: string | null) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "Activ";
    if (status === "finalizat") return "Final";
    return "-";
  };

  const getProjectTheme = (status: string | null) => {
    if (status === "in_asteptare") {
      return {
        dot: "bg-amber-600",
        text: "text-amber-700",
        badge: "bg-amber-50 text-amber-700",
        bar: "from-amber-500 to-yellow-300",
      };
    }

    if (status === "in_lucru") {
      return {
        dot: "bg-blue-600",
        text: "text-blue-700",
        badge: "bg-blue-50 text-blue-700",
        bar: "from-blue-600 to-blue-300",
      };
    }

    return {
      dot: "bg-green-600",
      text: "text-green-700",
      badge: "bg-green-50 text-green-700",
      bar: "from-green-600 to-green-300",
    };
  };

  const renderActionIcon = (label: string, dark?: boolean) => {
    const iconClass = `h-7 w-7 ${dark ? "text-slate-300" : ""}`;

    if (label.includes("Adaugă")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="4.5"
            y="4.5"
            width="15"
            height="15"
            rx="4"
            stroke={dark ? "currentColor" : "#2563EB"}
            strokeWidth="2"
          />
          <path
            d="M12 8.5v7M8.5 12h7"
            stroke={dark ? "currentColor" : "#2563EB"}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (label.includes("Vezi")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M6 8h12M6 12h12M6 16h8"
            stroke={dark ? "currentColor" : "#0F766E"}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle
            cx="10"
            cy="12"
            r="1.5"
            fill={dark ? "currentColor" : "#0F766E"}
          />
        </svg>
      );
    }

    if (label.includes("Comenzi")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M4 6h2l1.4 6.5h8.8L18 8H8.2"
            stroke={dark ? "currentColor" : "#D97706"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="18" r="1.5" fill={dark ? "currentColor" : "#D97706"} />
          <circle cx="17" cy="18" r="1.5" fill={dark ? "currentColor" : "#D97706"} />
        </svg>
      );
    }

    if (label.includes("Pontaje")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle
            cx="12"
            cy="12"
            r="7.5"
            stroke={dark ? "currentColor" : "#059669"}
            strokeWidth="2"
          />
          <path
            d="M12 8v4l2.8 2"
            stroke={dark ? "currentColor" : "#059669"}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (label.includes("Organizare")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle
            cx="12"
            cy="6.5"
            r="2"
            stroke={dark ? "currentColor" : "#1D4ED8"}
            strokeWidth="2"
          />
          <circle
            cx="7"
            cy="16.5"
            r="1.8"
            stroke={dark ? "currentColor" : "#1D4ED8"}
            strokeWidth="2"
          />
          <circle
            cx="17"
            cy="16.5"
            r="1.8"
            stroke={dark ? "currentColor" : "#1D4ED8"}
            strokeWidth="2"
          />
          <path
            d="M12 8.5v3M12 11.5l-5 3M12 11.5l5 3"
            stroke={dark ? "currentColor" : "#1D4ED8"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (label.includes("Panou")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (label.includes("Cerere")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M7 5h10l2 2v12H7V5Z"
            stroke={dark ? "currentColor" : "#2563EB"}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M10 11h6M10 15h4"
            stroke={dark ? "currentColor" : "#2563EB"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <circle cx="12" cy="12" r="4" fill={dark ? "currentColor" : "#2563EB"} />
      </svg>
    );
  };

  if (loading) {
    return <div className="p-8 text-lg font-medium">Se încarcă dashboard-ul...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Deconectare
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        <div className="hidden xl:grid xl:grid-cols-[1.35fr_1fr] xl:gap-6">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Bun venit,</p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                      {profile?.full_name}
                    </h1>

                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        {getRoleLabel(profile?.role)}
                      </span>
                    </div>
                  </div>

                  <div className="text-left text-xs uppercase tracking-[0.18em] text-gray-400 lg:text-right">
                    {todayLabel}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-blue-50 px-3 py-4 text-center">
                    <p className="text-3xl font-extrabold tracking-tight text-blue-600 sm:text-4xl">
                      {stats.total}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                      Total
                    </p>
                  </div>

                  <div className="rounded-2xl bg-amber-50 px-3 py-4 text-center">
                    <p className="text-3xl font-extrabold tracking-tight text-amber-600 sm:text-4xl">
                      {stats.inCurs}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                      În curs
                    </p>
                  </div>

                  <div className="rounded-2xl bg-green-50 px-3 py-4 text-center">
                    <p className="text-3xl font-extrabold tracking-tight text-green-600 sm:text-4xl">
                      {stats.finalizate}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-300">
                      Finalizate
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Acțiuni rapide
                </p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={`${action.label}-${action.sublabel}`}
                    type="button"
                    onClick={() => action.route && router.push(action.route)}
                    className={`relative min-h-[190px] overflow-hidden rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      action.dark
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-[#E8E5DE] bg-white text-gray-900"
                    }`}
                  >
                    <div
                      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-3xl ${
                        action.dark
                          ? "bg-slate-700"
                          : action.label.includes("Adaugă")
                          ? "bg-blue-50"
                          : action.label.includes("Vezi")
                          ? "bg-teal-100"
                          : action.label.includes("Comenzi")
                          ? "bg-amber-50"
                          : action.label.includes("Pontaje")
                          ? "bg-emerald-50"
                          : "bg-blue-50"
                      }`}
                    >
                      {renderActionIcon(action.label, action.dark)}
                    </div>

                    <p className="whitespace-pre-line text-sm font-bold leading-5 sm:text-base">
                      {action.label}
                    </p>

                    <p
                      className={`mt-1 text-xs sm:text-sm ${
                        action.dark ? "text-slate-400" : "text-gray-400"
                      }`}
                    >
                      {action.sublabel}
                    </p>

                    <div
                      className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-base ${
                        action.dark
                          ? "bg-slate-700 text-slate-300"
                          : "bg-[#F0EEE9] text-gray-400"
                      }`}
                    >
                      ›
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Proiecte active
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="space-y-3">
              {desktopProjects.length === 0 ? (
                <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-500">
                    Nu există proiecte active momentan.
                  </p>
                </div>
              ) : (
                desktopProjects.map((project) => {
                  const percent = getProjectPercent(project);
                  const theme = getProjectTheme(project.status);

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => router.push("/proiecte")}
                      className="w-full rounded-2xl border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                          <p className="text-sm font-semibold text-gray-900 sm:text-base">
                            {project.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${theme.text}`}>
                            {percent}%
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.badge}`}
                          >
                            {getProjectStatusLabel(project.status)}
                          </span>
                        </div>
                      </div>

                      <p className="mb-3 text-xs text-gray-500 sm:text-sm">
                        {project.beneficiary || "-"}
                      </p>

                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F0EEE9]">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="xl:hidden">
          <section className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Bun venit,</p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {profile?.full_name}
                  </h1>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                      {getRoleLabel(profile?.role)}
                    </span>
                  </div>
                </div>

                <div className="text-left text-xs uppercase tracking-[0.18em] text-gray-400 lg:text-right">
                  {todayLabel}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-blue-50 px-3 py-4 text-center">
                  <p className="text-3xl font-extrabold tracking-tight text-blue-600 sm:text-4xl">
                    {stats.total}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                    Total
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 px-3 py-4 text-center">
                  <p className="text-3xl font-extrabold tracking-tight text-amber-600 sm:text-4xl">
                    {stats.inCurs}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                    În curs
                  </p>
                </div>

                <div className="rounded-2xl bg-green-50 px-3 py-4 text-center">
                  <p className="text-3xl font-extrabold tracking-tight text-green-600 sm:text-4xl">
                    {stats.finalizate}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-300">
                    Finalizate
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Acțiuni rapide
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={`${action.label}-${action.sublabel}`}
                  type="button"
                  onClick={() => action.route && router.push(action.route)}
                  className={`relative min-h-[190px] overflow-hidden rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    action.dark
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-[#E8E5DE] bg-white text-gray-900"
                  }`}
                >
                  <div
                    className={`mb-4 flex h-14 w-14 items-center justify-center rounded-3xl ${
                      action.dark
                        ? "bg-slate-700"
                        : action.label.includes("Adaugă")
                        ? "bg-blue-50"
                        : action.label.includes("Vezi")
                        ? "bg-teal-100"
                        : action.label.includes("Comenzi")
                        ? "bg-amber-50"
                        : action.label.includes("Pontaje")
                        ? "bg-emerald-50"
                        : "bg-blue-50"
                    }`}
                  >
                    {renderActionIcon(action.label, action.dark)}
                  </div>

                  <p className="whitespace-pre-line text-sm font-bold leading-5 sm:text-base">
                    {action.label}
                  </p>

                  <p
                    className={`mt-1 text-xs sm:text-sm ${
                      action.dark ? "text-slate-400" : "text-gray-400"
                    }`}
                  >
                    {action.sublabel}
                  </p>

                  <div
                    className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-base ${
                      action.dark
                        ? "bg-slate-700 text-slate-300"
                        : "bg-[#F0EEE9] text-gray-400"
                    }`}
                  >
                    ›
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Proiecte active
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="space-y-3">
              {mobileProjects.length === 0 ? (
                <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-500">
                    Nu există proiecte active momentan.
                  </p>
                </div>
              ) : (
                mobileProjects.map((project) => {
                  const percent = getProjectPercent(project);
                  const theme = getProjectTheme(project.status);

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => router.push("/proiecte")}
                      className="w-full rounded-2xl border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                          <p className="text-sm font-semibold text-gray-900">
                            {project.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${theme.text}`}>
                            {percent}%
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.badge}`}
                          >
                            {getProjectStatusLabel(project.status)}
                          </span>
                        </div>
                      </div>

                      <p className="mb-3 text-xs text-gray-500">
                        {project.beneficiary || "-"}
                      </p>

                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F0EEE9]">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-[#E8E5DE] bg-white/95 px-2 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <button className="flex flex-col items-center gap-1 py-1 text-blue-600">
            <span className="text-2xl">🏠</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
              Acasă
            </span>
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
          </button>

          <button
            onClick={() => router.push("/proiecte")}
            className="flex flex-col items-center gap-1 py-1 text-gray-400"
          >
            <span className="text-2xl">📋</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
              Proiecte
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 py-1 text-gray-400">
            <span className="text-2xl">🔔</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
              Notificări
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 py-1 text-gray-400">
            <span className="text-2xl">👤</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
              Profil
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}