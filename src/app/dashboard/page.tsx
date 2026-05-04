"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "administrator" | "cont_tehnic" | "project_manager" | "admin_limitat" | "sef_echipa" | "user";
type Profile = { id: string; full_name: string; role: Role };
type ProjectStats = { total: number; inCurs: number; finalizate: number };
type ActiveProject = {
  id: string; name: string; beneficiary: string | null;
  status: string | null; start_date?: string | null;
  execution_deadline?: string | null; created_at: string;
};
type QuickAction = { label: string; sublabel: string; route?: string; dark?: boolean };

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [unpaidOreCount, setUnpaidOreCount] = useState(0);
  const [pendingAlimentariCount, setPendingAlimentariCount] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProjectStats>({ total: 0, inCurs: 0, finalizate: 0 });
  const [projects, setProjects] = useState<ActiveProject[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profileData, error: profileError } = await supabase
        .from("profiles").select("id, full_name, role").eq("id", user.id).single();
      if (profileError || !profileData) { router.push("/login"); return; }
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, beneficiary, status, start_date, execution_deadline, created_at")
        .order("created_at", { ascending: false });
      if (!projectsError && projectsData) {
        const p = projectsData as ActiveProject[];
        setStats({ total: p.length, inCurs: p.filter((x) => x.status === "in_lucru").length, finalizate: p.filter((x) => x.status === "finalizat").length });
        setProjects(p);
      }
      setProfile(profileData as Profile);

      // Notificari doar pentru admin_limitat
      if (profileData.role === "admin_limitat") {
        const [extraRes, reqRes] = await Promise.all([
          supabase.from("extra_work").select("id, extra_hours, weekend_days_count, extra_hours_paid, weekend_paid"),
          supabase.from("funding_requests").select("id, status").eq("status", "pending"),
        ]);
        if (!extraRes.error && extraRes.data) {
          setUnpaidOreCount(extraRes.data.filter((row) => {
            const hasExtra = Number(row.extra_hours || 0) > 0;
            const hasWeekend = Number(row.weekend_days_count || 0) > 0;
            return (hasExtra && !row.extra_hours_paid) || (hasWeekend && !row.weekend_paid);
          }).length);
        }
        setPendingAlimentariCount((reqRes.data || []).length);
      }

      setLoading(false);
    };
    loadDashboard();
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const todayLabel = useMemo(() => new Date().toLocaleDateString("ro-RO", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  }), []);

  const getRoleLabel = (role?: Role) => {
    if (role === "administrator") return "Administrator";
    if (role === "cont_tehnic") return "Cont tehnic";
    if (role === "project_manager") return "Project Manager";
    if (role === "admin_limitat") return "Cont de administrare limitat";
    if (role === "sef_echipa") return "Șef de echipă";
    if (role === "user") return "Utilizator";
    return "-";
  };

  const adminActions: QuickAction[] = [
    { label: "Adaugă\nProiect", sublabel: "Proiect nou", route: "/proiecte/adauga" },
    { label: "Vezi\nProiecte", sublabel: `${stats.total} active`, route: "/proiecte" },
    { label: "Comenzi\nMateriale", sublabel: "Gestionează", route: "/comenzi" },
    { label: "Organizare\nEchipe", sublabel: "Planificare", route: "/organizarea-echipelor" },
    { label: "Devize", sublabel: "Ofertă / lucrare", route: "/devize" },
    { label: "Panou\nAdmin", sublabel: "Setări sistem", route: "/admin", dark: true },
  ];

  const projectManagerActions: QuickAction[] = [
    { label: "Adaugă\nProiect", sublabel: "Proiect nou", route: "/proiecte/adauga" },
    { label: "Vezi\nProiecte", sublabel: `${stats.total} active`, route: "/proiecte" },
    { label: "Comenzi\nMateriale", sublabel: "Gestionează", route: "/comenzi" },
    { label: "Devize", sublabel: "Ofertă / lucrare", route: "/devize" },
    { label: "Pontare", sublabel: "Toate șantierele", route: "/pontaje" },
    { label: "Organizare\nEchipe", sublabel: "Planificare", route: "/organizarea-echipelor" },
    { label: "Modul\nAdministrativ", sublabel: "Concedii, setări", route: "/modul-admin", dark: true },
  ];

  const adminLimitatActions: QuickAction[] = [
    { label: "Vezi\nProiecte", sublabel: `${stats.total} active`, route: "/proiecte" },
    { label: "Comenzi\nMateriale", sublabel: "Vizualizare", route: "/comenzi" },
    { label: "Ore Extra +\nWeekend", sublabel: "Pontaje speciale", route: "/admin/ore-extra" },
    { label: "Alimentare\nCarduri", sublabel: "Carduri / Conturi", route: "/admin/alimentari" },
    { label: "Modul\nAdministrativ", sublabel: "Setări limitate", route: "/admin", dark: true },
  ];

  const teamLeadActions: QuickAction[] = [
    { label: "Proiectele\nMele", sublabel: "Șantiere active", route: "/proiecte" },
    { label: "Comenzi\nMateriale", sublabel: "Gestionează", route: "/comenzi" },
    { label: "Pontare", sublabel: "Echipă azi", route: "/pontaje" },
    { label: "Ore Extra /\nWeekend", sublabel: "Pontaje speciale", route: "/ore-extra-weekend" },
    { label: "Organizare\nEchipe", sublabel: "Planificare", route: "/organizarea-echipelor" },
    { label: "Solicită\nBani", sublabel: "Financiar", route: "/solicita-bani" },
  ];

  const userActions: QuickAction[] = [
    { label: "Dashboard\nUser", sublabel: "Rezumat" },
    { label: "Vezi\nProiecte", sublabel: "Listă proiecte", route: "/proiecte" },
    { label: "Organizare\nEchipe", sublabel: "Programări", route: "/organizarea-echipelor" },
  ];

  const quickActions =
    profile?.role === "administrator" || profile?.role === "cont_tehnic" ? adminActions
    : profile?.role === "project_manager" ? projectManagerActions
    : profile?.role === "admin_limitat" ? adminLimitatActions
    : profile?.role === "sef_echipa" ? teamLeadActions
    : userActions;

  // Ordonare de jos in sus: finalizate → in_asteptare → in_lucru
  // In UI se afiseaza in ordine normala dar cu finalizatele la inceput (jos)
  const activeProjects = useMemo(() => {
    const order: Record<string, number> = { "finalizat": 0, "in_asteptare": 1, "in_lucru": 2 };
    return [...projects].sort((a, b) => (order[a.status || ""] ?? 1) - (order[b.status || ""] ?? 1));
  }, [projects]);
  const desktopProjects = useMemo(() => activeProjects.slice(0, 4), [activeProjects]);
  const mobileProjects = useMemo(() => activeProjects.slice(0, 6), [activeProjects]);

  const getProjectStatusLabel = (s: string | null) => s === "in_asteptare" ? "În așteptare" : s === "in_lucru" ? "Activ" : s === "finalizat" ? "Final" : "-";

  // Calculeaza progresul real bazat pe datele de inceput si sfarsit
  const getProjectProgress = (p: ActiveProject): number => {
    if (p.status === "finalizat") return 100;
    if (p.status === "in_asteptare") return 0;
    // in_lucru — calcul proportional
    if (!p.start_date || !p.execution_deadline) return 50; // fallback daca lipsesc datele
    const start = new Date(p.start_date).getTime();
    const end = new Date(p.execution_deadline).getTime();
    const now = new Date().getTime();
    if (now <= start) return 0;
    if (now >= end) return 99; // nu ajunge la 100 pana nu e finalizat manual
    const total = end - start;
    if (total <= 0) return 50;
    return Math.round(((now - start) / total) * 100);
  };

  // Culoarea barei pentru proiecte in lucru: rosu → galben → verde
  const getBarColor = (percent: number): string => {
    if (percent < 30) return "from-red-500 to-red-400";
    if (percent < 60) return "from-orange-500 to-yellow-400";
    if (percent < 85) return "from-yellow-400 to-lime-400";
    return "from-lime-500 to-green-400";
  };

  const getProjectTheme = (p: ActiveProject) => {
    const s = p.status;
    const percent = getProjectProgress(p);
    if (s === "in_asteptare") return {
      dot: "bg-blue-500",
      text: "text-blue-600",
      badge: "bg-blue-50 text-blue-700",
      bar: "from-blue-400 to-blue-300",
      percent: 0,
    };
    if (s === "finalizat") return {
      dot: "bg-green-600",
      text: "text-green-700",
      badge: "bg-green-100 text-green-700",
      bar: "from-green-500 to-green-400",
      percent: 100,
    };
    // in_lucru
    return {
      dot: percent >= 85 ? "bg-green-500" : percent >= 60 ? "bg-yellow-500" : percent >= 30 ? "bg-orange-500" : "bg-red-500",
      text: percent >= 85 ? "text-green-600" : percent >= 60 ? "text-yellow-600" : percent >= 30 ? "text-orange-500" : "text-red-500",
      badge: "bg-blue-50 text-blue-700",
      bar: getBarColor(percent),
      percent,
    };
  };

  const getActionBg = (label: string, dark?: boolean) => {
    if (dark) return "bg-slate-700";
    if (label.includes("Adaugă")) return "bg-blue-50";
    if (label.includes("Vezi") || label.includes("Proiectele")) return "bg-teal-100";
    if (label.includes("Comenzi")) return "bg-amber-50";
    if (label.includes("Pontare")) return "bg-emerald-50";
    if (label.includes("Ore Extra")) return "bg-purple-50";
    if (label.includes("Alimentare")) return "bg-green-50";
    if (label.includes("Deviz")) return "bg-green-50";
    if (label.includes("Organizare")) return "bg-blue-50";
    return "bg-blue-50";
  };

  const renderActionIcon = (label: string, dark?: boolean) => {
    const c = `h-6 w-6 sm:h-7 sm:w-7 ${dark ? "text-slate-300" : ""}`;
    if (label.includes("Adaugă")) return <svg viewBox="0 0 24 24" fill="none" className={c}><rect x="4.5" y="4.5" width="15" height="15" rx="4" stroke={dark ? "currentColor" : "#2563EB"} strokeWidth="2" /><path d="M12 8.5v7M8.5 12h7" stroke={dark ? "currentColor" : "#2563EB"} strokeWidth="2.2" strokeLinecap="round" /></svg>;
    if (label.includes("Comenzi")) return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M4 6h2l1.4 6.5h8.8L18 8H8.2" stroke={dark ? "currentColor" : "#D97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="18" r="1.5" fill={dark ? "currentColor" : "#D97706"} /><circle cx="17" cy="18" r="1.5" fill={dark ? "currentColor" : "#D97706"} /></svg>;
    if (label.includes("Pontare")) return <svg viewBox="0 0 24 24" fill="none" className={c}><circle cx="12" cy="12" r="7.5" stroke={dark ? "currentColor" : "#059669"} strokeWidth="2" /><path d="M12 8v4l2.8 2" stroke={dark ? "currentColor" : "#059669"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    if (label.includes("Ore Extra")) return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M12 4v16M4 12h16" stroke={dark ? "currentColor" : "#7C3AED"} strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="12" r="8" stroke={dark ? "currentColor" : "#7C3AED"} strokeWidth="2" /></svg>;
    if (label.includes("Organizare")) return <svg viewBox="0 0 24 24" fill="none" className={c}><circle cx="12" cy="6.5" r="2" stroke={dark ? "currentColor" : "#1D4ED8"} strokeWidth="2" /><circle cx="7" cy="16.5" r="1.8" stroke={dark ? "currentColor" : "#1D4ED8"} strokeWidth="2" /><circle cx="17" cy="16.5" r="1.8" stroke={dark ? "currentColor" : "#1D4ED8"} strokeWidth="2" /><path d="M12 8.5v3M12 11.5l-5 3M12 11.5l5 3" stroke={dark ? "currentColor" : "#1D4ED8"} strokeWidth="2" strokeLinecap="round" /></svg>;
    if (label.includes("Panou") || label.includes("Modul")) return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="2" /><path d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    if (label.includes("Solicită")) return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M7 5h10l2 2v12H7V5Z" stroke={dark ? "currentColor" : "#2563EB"} strokeWidth="2" strokeLinejoin="round" /><path d="M10 11h6M10 15h4" stroke={dark ? "currentColor" : "#2563EB"} strokeWidth="2" strokeLinecap="round" /></svg>;
    if (label.includes("Alimentare")) return <svg viewBox="0 0 24 24" fill="none" className={c}><rect x="4" y="6" width="16" height="12" rx="3" stroke={dark ? "currentColor" : "#16A34A"} strokeWidth="2" /><path d="M8 12h8M14 9l3 3-3 3" stroke={dark ? "currentColor" : "#16A34A"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    if (label.includes("Deviz")) return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Z" stroke={dark ? "currentColor" : "#16A34A"} strokeWidth="2" strokeLinejoin="round" /><path d="M8 9h8M8 13h8M8 17h5" stroke={dark ? "currentColor" : "#16A34A"} strokeWidth="2" strokeLinecap="round" /></svg>;
    return <svg viewBox="0 0 24 24" fill="none" className={c}><path d="M6 8h12M6 12h12M6 16h8" stroke={dark ? "currentColor" : "#0F766E"} strokeWidth="2.2" strokeLinecap="round" /></svg>;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
      </div>
    );
  }

  const StatsCards = ({ small }: { small?: boolean }) => (
    <div className={`grid grid-cols-3 ${small ? "gap-2" : "gap-3"}`}>
      {[
        { val: stats.total, label: "Total", color: "blue" },
        { val: stats.inCurs, label: "În curs", color: "amber" },
        { val: stats.finalizate, label: "Finalizate", color: "green" },
      ].map(({ val, label, color }) => (
        <div key={label} className={`rounded-2xl bg-${color}-50 ${small ? "px-2 py-3" : "px-3 py-4"} text-center`}>
          <p className={`${small ? "text-2xl" : "text-3xl sm:text-4xl"} font-extrabold tracking-tight text-${color}-600`}>{val}</p>
          <p className={`mt-1 ${small ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-[0.12em] text-${color}-300`}>{label}</p>
        </div>
      ))}
    </div>
  );

  const ProjectCard = ({ project }: { project: ActiveProject }) => {
    const theme = getProjectTheme(project);
    const percent = theme.percent;
    return (
      <button type="button" onClick={() => router.push("/proiecte")}
        className="w-full rounded-2xl border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
            <p className="text-sm font-semibold text-gray-900 sm:text-base">{project.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {project.status === "in_lucru" && (
              <span className={`text-xs font-semibold ${theme.text}`}>{percent}%</span>
            )}
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.badge}`}>
              {getProjectStatusLabel(project.status)}
            </span>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500 sm:text-sm">{project.beneficiary || "-"}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#F0EEE9]">
          <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${theme.bar}`}
            style={{ width: `${percent}%` }} />
        </div>
        {project.status === "in_lucru" && project.execution_deadline && (
          <p className="mt-2 text-[10px] text-gray-400">
            Termen: {new Date(project.execution_deadline).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </button>
    );
  };

  const ActionButton = ({ action, minH = "min-h-[190px]" }: { action: QuickAction; minH?: string }) => (
    <button type="button" onClick={() => action.route && router.push(action.route)}
      className={`relative overflow-hidden rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${minH} ${
        action.dark ? "border-slate-800 bg-slate-800 text-white" : "border-[#E8E5DE] bg-white text-gray-900"
      }`}>
      {/* Badge notificari ore extra — admin_limitat */}
      {action.label.includes("Ore Extra") && unpaidOreCount > 0 && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {unpaidOreCount > 9 ? "9+" : unpaidOreCount}
        </span>
      )}
      {/* Badge notificari alimentare — admin_limitat */}
      {action.label.includes("Alimentare") && pendingAlimentariCount > 0 && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {pendingAlimentariCount > 9 ? "9+" : pendingAlimentariCount}
        </span>
      )}
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-3xl ${getActionBg(action.label, action.dark)}`}>
        {renderActionIcon(action.label, action.dark)}
      </div>
      <p className="whitespace-pre-line text-sm font-bold leading-5 sm:text-base">{action.label}</p>
      <p className={`mt-1 text-xs sm:text-sm ${action.dark ? "text-slate-400" : "text-gray-400"}`}>{action.sublabel}</p>
      <div className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-base ${
        action.dark ? "bg-slate-700 text-slate-300" : "bg-[#F0EEE9] text-gray-400"
      }`}>›</div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/profil")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-[#0196ff]"
              title="Profil">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
              </svg>
            </button>
            <button onClick={handleLogout}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
              Deconectare
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        <div className="hidden xl:grid xl:grid-cols-[1.35fr_1fr] xl:gap-6">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Bun venit,</p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{profile?.full_name}</h1>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{getRoleLabel(profile?.role)}</span>
                  </div>
                </div>
                <div className="text-left text-xs uppercase tracking-[0.18em] text-gray-400 lg:text-right">{todayLabel}</div>
              </div>
              <div className="mt-4"><StatsCards /></div>
            </section>
            <section>
              <div className="mb-3 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Acțiuni rapide</p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => <ActionButton key={`${action.label}-d`} action={action} />)}
              </div>
            </section>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Proiecte active</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="space-y-3">
              {desktopProjects.length === 0
                ? <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Nu există proiecte active momentan.</p></div>
                : desktopProjects.map((p) => <ProjectCard key={p.id} project={p} />)
              }
            </div>
          </div>
        </div>

        <div className="xl:hidden">
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm text-gray-500">Bun venit,</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{profile?.full_name}</h1>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{getRoleLabel(profile?.role)}</span>
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">{todayLabel}</div>
            </div>
            <div className="mt-4"><StatsCards small /></div>
          </section>
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Acțiuni rapide</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {quickActions.map((action) => <ActionButton key={`${action.label}-m`} action={action} minH="min-h-[160px] sm:min-h-[190px]" />)}
            </div>
          </section>
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Proiecte active</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="space-y-3">
              {mobileProjects.length === 0
                ? <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Nu există proiecte active momentan.</p></div>
                : mobileProjects.map((p) => <ProjectCard key={p.id} project={p} />)
              }
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-[#E8E5DE] bg-white/95 px-2 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 py-1 text-blue-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Acasă</span>
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
          </button>
          <button onClick={() => router.push("/proiecte")} className="flex flex-col items-center gap-1 py-1 text-gray-400 transition hover:text-gray-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <path d="M6 8h12M6 12h12M6 16h8" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Proiecte</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-1 text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Notificări</span>
          </button>
          <button onClick={() => router.push("/profil")} className="flex flex-col items-center gap-1 py-1 text-gray-400 transition hover:text-[#0196ff]">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
