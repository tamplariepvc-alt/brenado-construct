"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AdminAction = {
  label: string;
  sublabel: string;
  route: string;
  dark?: boolean;
  highlight?: "blue" | "green";
};

export default function AdminPage() {
  const router = useRouter();
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    const loadUnpaidCount = async () => {
      const { data, error } = await supabase
        .from("extra_work")
        .select("id, extra_hours, weekend_days_count, extra_hours_paid, weekend_paid");

      if (error || !data) { setUnpaidCount(0); return; }

      const count = data.filter((row) => {
        const hasExtra = Number(row.extra_hours || 0) > 0;
        const hasWeekend = Number(row.weekend_days_count || 0) > 0;
        return (hasExtra && !row.extra_hours_paid) || (hasWeekend && !row.weekend_paid);
      }).length;

      setUnpaidCount(count);
    };

    loadUnpaidCount();
  }, []);

  const actions: AdminAction[] = [
    {
      label: "Centre de cost",
      sublabel: "Vezi toate proiectele și costurile aferente",
      route: "/admin/centre-de-cost",
    },
    {
      label: "Muncitori",
      sublabel: "Gestionează muncitorii și salariile lunare",
      route: "/admin/muncitori",
    },
    {
      label: "Parc Auto",
      sublabel: "Vehicule, documente și leasing",
      route: "/admin/parc-auto",
    },
    {
      label: "Ore Extra + Weekend",
      sublabel: "Filtrează, achită și exportă rapoarte",
      route: "/admin/ore-extra",
      highlight: "blue",
    },
    {
      label: "Alimentare Carduri / Conturi",
      sublabel: "Alimentează proiectele și vezi istoricul",
      route: "/admin/alimentari",
      highlight: "green",
    },
  ];

  const renderAdminIcon = (label: string, dark?: boolean, highlight?: "blue" | "green") => {
    const base = dark || highlight === "blue" || highlight === "green" ? "currentColor" : "#2563EB";
    const iconClass = `h-6 w-6 sm:h-7 sm:w-7 ${
      dark ? "text-slate-300"
      : highlight === "blue" ? "text-white"
      : highlight === "green" ? "text-white"
      : ""
    }`;

    if (label.includes("Centre")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect x="4" y="4" width="7" height="7" rx="2" stroke={base} strokeWidth="2" />
          <rect x="13" y="4" width="7" height="4" rx="2" stroke={base} strokeWidth="2" />
          <rect x="13" y="10" width="7" height="10" rx="2" stroke={base} strokeWidth="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" stroke={base} strokeWidth="2" />
        </svg>
      );
    }
    if (label.includes("Muncitori")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="9" cy="8" r="3" stroke={base} strokeWidth="2" />
          <circle cx="17" cy="10" r="2.5" stroke={base} strokeWidth="2" />
          <path d="M4 18c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={base} strokeWidth="2" strokeLinecap="round" />
          <path d="M14 18c.2-1.8 1.8-3.2 4-3.2 1.1 0 2.1.3 2.9.9" stroke={base} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }
    if (label.includes("Parc")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke={base} strokeWidth="2" strokeLinejoin="round" />
          <path d="M5 16v2M19 16v2" stroke={base} strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="17" r="1.5" fill={base} />
          <circle cx="16" cy="17" r="1.5" fill={base} />
        </svg>
      );
    }
    if (label.includes("Ore")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="12" cy="12" r="7.5" stroke={base} strokeWidth="2" />
          <path d="M12 8v4l3 2" stroke={base} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (label.includes("Alimentare")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect x="4" y="6" width="16" height="12" rx="3" stroke={base} strokeWidth="2" />
          <path d="M8 12h8M14 9l3 3-3 3" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <circle cx="12" cy="12" r="4" fill={base} />
      </svg>
    );
  };

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Modul administrativ</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Panou Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Gestionare date, module administrative și funcții financiare.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Module administrative
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => {
              const isBlue = action.highlight === "blue";
              const isGreen = action.highlight === "green";

              return (
                <button
                  key={`${action.label}-${action.route}`}
                  type="button"
                  onClick={() => router.push(action.route)}
                  className={`relative min-h-[160px] overflow-hidden rounded-[22px] border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[180px] sm:p-6 ${
                    isBlue
                      ? "border-[#0196ff] bg-[#0196ff] text-white"
                      : isGreen
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-[#E8E5DE] bg-white text-gray-900"
                  }`}
                >
                  {action.label.includes("Ore") && unpaidCount > 0 && (
                    <span className="absolute right-4 top-4 inline-flex min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      {unpaidCount}
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl sm:h-14 sm:w-14 ${
                        isBlue ? "bg-white/15"
                        : isGreen ? "bg-white/15"
                        : action.label.includes("Centre") ? "bg-blue-50"
                        : action.label.includes("Muncitori") ? "bg-sky-50"
                        : action.label.includes("Parc") ? "bg-amber-50"
                        : "bg-blue-50"
                      }`}
                    >
                      {renderAdminIcon(action.label, false, action.highlight)}
                    </div>

                    {/* ← TEXT MARIT AICI */}
                    <p className="text-xl font-extrabold leading-6 tracking-tight sm:text-2xl sm:leading-7">
                      {action.label}
                    </p>
                  </div>

                  <p
                    className={`mt-4 pr-12 text-sm leading-5 sm:text-[15px] sm:leading-6 ${
                      isBlue || isGreen ? "text-white/80" : "text-gray-400"
                    }`}
                  >
                    {action.sublabel}
                  </p>

                  <div
                    className={`absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-sm sm:h-8 sm:w-8 sm:text-base ${
                      isBlue || isGreen ? "bg-white/15 text-white" : "bg-[#F0EEE9] text-gray-400"
                    }`}
                  >
                    ›
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
