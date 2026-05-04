"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Role = "administrator" | "cont_tehnic" | "project_manager" | "admin_limitat" | "sef_echipa" | "user";

type AdminAction = {
  label: string;
  sublabel: string;
  route: string;
  highlight?: "blue" | "green" | "indigo" | "violet";
  roles?: Role[]; // daca lipseste = vizibil pentru toti
};

export default function AdminPage() {
  const router = useRouter();
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (!profile) { router.push("/login"); return; }

      const allowed = ["administrator", "cont_tehnic", "admin_limitat"];
      if (!allowed.includes(profile.role)) { router.push("/dashboard"); return; }

      setUserRole(profile.role as Role);

      const { data, error } = await supabase
        .from("extra_work")
        .select("id, extra_hours, weekend_days_count, extra_hours_paid, weekend_paid");
      if (!error && data) {
        const count = data.filter((row) => {
          const hasExtra = Number(row.extra_hours || 0) > 0;
          const hasWeekend = Number(row.weekend_days_count || 0) > 0;
          return (hasExtra && !row.extra_hours_paid) || (hasWeekend && !row.weekend_paid);
        }).length;
        setUnpaidCount(count);
      }

      const { data: reqData } = await supabase
        .from("funding_requests")
        .select("id, status")
        .eq("status", "pending");
      setPendingRequestsCount((reqData || []).length);

      setLoading(false);
    };
    init();
  }, [router]);

  // Toate actiunile cu rolurile care le pot vedea
  const allActions: AdminAction[] = [
    {
      label: "Centre de cost",
      sublabel: "Vezi toate proiectele și costurile aferente",
      route: "/admin/centre-de-cost",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Personal",
      sublabel: "Gestionează personalul, funcțiile și salariile",
      route: "/admin/muncitori",
      // toti
    },
    {
      label: "Parc Auto",
      sublabel: "Vehicule, documente și leasing",
      route: "/admin/parc-auto",
      // toti
    },
    {
      label: "Ore Extra + Weekend",
      sublabel: "Filtrează, achită și exportă rapoarte",
      route: "/admin/ore-extra",
      highlight: "blue",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Alimentare Carduri",
      sublabel: "Alimentează proiectele și vezi istoricul",
      route: "/admin/alimentari",
      highlight: "green",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Istoric Pontaje",
      sublabel: "Vizualizează pontajele pe șantiere, zile și personal",
      route: "/admin/istoric-pontaje",
      highlight: "indigo",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Concedii",
      sublabel: "Gestionează zilele de concediu și aprobă solicitările",
      route: "/admin/concediu",
      // toti
    },
    {
      label: "Utilizatori",
      sublabel: "Gestionează conturile și rolurile utilizatorilor",
      route: "/admin/utilizatori",
      highlight: "violet",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Alte Setări",
      sublabel: "Servicii, materiale și configurări",
      route: "/admin/setari",
      roles: ["administrator", "cont_tehnic"],
    },
    {
      label: "Articole Comenzi",
      sublabel: "Gestionează catalogul de articole pentru comenzi",
      route: "/admin/setari/materiale",
      roles: ["admin_limitat"],
    },
  ];

  // Filtrare actiuni pe baza rolului
  const actions = allActions.filter((action) => {
    if (!userRole) return false;
    if (!action.roles) return true; // vizibil pentru toti
    return action.roles.includes(userRole);
  });

  const isAdminLimitat = userRole === "admin_limitat";

  const renderAdminIcon = (label: string, highlight?: string) => {
    const isColored = !!highlight;
    const base = isColored ? "currentColor" : "#2563EB";
    const cls = `h-6 w-6 sm:h-7 sm:w-7 ${isColored ? "text-white" : ""}`;

    if (label.includes("Centre")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="4" y="4" width="7" height="7" rx="2" stroke={base} strokeWidth="2" />
        <rect x="13" y="4" width="7" height="4" rx="2" stroke={base} strokeWidth="2" />
        <rect x="13" y="10" width="7" height="10" rx="2" stroke={base} strokeWidth="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke={base} strokeWidth="2" />
      </svg>
    );
    if (label.includes("Personal")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <circle cx="9" cy="8" r="3" stroke={base} strokeWidth="2" />
        <circle cx="17" cy="10" r="2.5" stroke={base} strokeWidth="2" />
        <path d="M4 18c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={base} strokeWidth="2" strokeLinecap="round" />
        <path d="M14 18c.2-1.8 1.8-3.2 4-3.2 1.1 0 2.1.3 2.9.9" stroke={base} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
    if (label.includes("Parc")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke={base} strokeWidth="2" strokeLinejoin="round" />
        <path d="M5 16v2M19 16v2" stroke={base} strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="17" r="1.5" fill={base} />
        <circle cx="16" cy="17" r="1.5" fill={base} />
      </svg>
    );
    if (label.includes("Ore")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <circle cx="12" cy="12" r="7.5" stroke={base} strokeWidth="2" />
        <path d="M12 8v4l3 2" stroke={base} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (label.includes("Alimentare")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="4" y="6" width="16" height="12" rx="3" stroke={base} strokeWidth="2" />
        <path d="M8 12h8M14 9l3 3-3 3" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (label.includes("Istoric")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="5" y="4" width="14" height="16" rx="2" stroke={base} strokeWidth="2" />
        <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke={base} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
    if (label.includes("Concedii")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke={base} strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke={base} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 15h2M14 15h2M8 19h2" stroke={base} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
    if (label.includes("Utilizatori")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <circle cx="12" cy="8" r="3.5" stroke={base} strokeWidth="2" />
        <path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke={base} strokeWidth="2" strokeLinecap="round" />
        <circle cx="19" cy="8" r="2" stroke={base} strokeWidth="1.8" />
        <path d="M19 6v2l1 1" stroke={base} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (label.includes("Setări") || label.includes("Articole")) return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke={base} strokeWidth="2" />
        <path d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z" stroke={base} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
    return <svg viewBox="0 0 24 24" fill="none" className={cls}><circle cx="12" cy="12" r="4" fill={base} /></svg>;
  };

  const getBgClasses = (action: AdminAction) => {
    if (action.highlight === "blue") return "border-[#0196ff] bg-[#0196ff] text-white";
    if (action.highlight === "green") return "border-green-600 bg-green-600 text-white";
    if (action.highlight === "indigo") return "border-indigo-600 bg-indigo-600 text-white";
    if (action.highlight === "violet") return "border-violet-600 bg-violet-600 text-white";
    return "border-[#E8E5DE] bg-white text-gray-900";
  };

  const getIconBg = (action: AdminAction) => {
    if (action.highlight) return "bg-white/15";
    if (action.label.includes("Centre")) return "bg-blue-50";
    if (action.label.includes("Personal")) return "bg-sky-50";
    if (action.label.includes("Parc")) return "bg-amber-50";
    if (action.label.includes("Concedii")) return "bg-green-50";
    if (action.label.includes("Setări") || action.label.includes("Articole")) return "bg-gray-100";
    return "bg-blue-50";
  };

  const isColored = (action: AdminAction) => Boolean(action.highlight);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div>
            <p className="text-sm text-gray-500">Modul administrativ</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {isAdminLimitat ? "Modul Administrativ" : "Panou Admin"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
              {isAdminLimitat
                ? "Acces la modulele administrative permise pentru rolul tău."
                : "Gestionare date, module administrative și funcții financiare."}
            </p>
            {isAdminLimitat && (
              <span className="mt-2 inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                Cont de administrare limitat
              </span>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Module administrative</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <button key={`${action.label}-${action.route}`} type="button"
                onClick={() => router.push(action.route)}
                className={`relative min-h-[160px] overflow-hidden rounded-[22px] border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[180px] sm:p-6 ${getBgClasses(action)}`}>

                {action.label.includes("Ore") && unpaidCount > 0 && (
                  <span className="absolute right-4 top-4 inline-flex min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    {unpaidCount}
                  </span>
                )}
                {action.label.includes("Alimentare") && pendingRequestsCount > 0 && (
                  <span className="absolute right-4 top-4 inline-flex min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    {pendingRequestsCount}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl sm:h-14 sm:w-14 ${getIconBg(action)}`}>
                    {renderAdminIcon(action.label, action.highlight)}
                  </div>
                  <p className="text-xl font-extrabold leading-6 tracking-tight sm:text-2xl sm:leading-7">
                    {action.label}
                  </p>
                </div>

                <p className={`mt-4 pr-12 text-sm leading-5 sm:text-[15px] sm:leading-6 ${
                  isColored(action) ? "text-white/80" : "text-gray-400"
                }`}>
                  {action.sublabel}
                </p>

                <div className={`absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-sm sm:h-8 sm:w-8 sm:text-base ${
                  isColored(action) ? "bg-white/15 text-white" : "bg-[#F0EEE9] text-gray-400"
                }`}>›</div>
              </button>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
