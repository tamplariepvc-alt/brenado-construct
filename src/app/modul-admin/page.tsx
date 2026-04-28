"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

export default function ModulAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "project_manager") { router.push("/dashboard"); return; }
      setLoading(false);
    };
    check();
  }, [router]);

  const sections = [
    {
      label: "Concedii",
      sublabel: "Gestionează zilele de concediu și aprobă solicitările",
      route: "/admin/concediu",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 sm:h-7 sm:w-7 text-green-700">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 15h2M14 15h2M8 19h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      bg: "bg-green-50",
    },
    {
      label: "Alte Setări",
      sublabel: "Servicii deviz și articole comenzi",
      route: "/admin/setari",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 sm:h-7 sm:w-7 text-gray-600">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="2" />
          <path d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
      bg: "bg-gray-100",
    },
    {
      label: "Alimentări",
      sublabel: "Vizualizează istoricul alimentărilor (doar citire)",
      route: "/admin/alimentari",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 sm:h-7 sm:w-7 text-green-600">
          <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12h8M14 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-green-50",
      badge: "Vizualizare",
    },
  ];

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
            <p className="text-sm text-gray-500">Project Manager</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Modul Administrativ</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
              Acces la modulele administrative disponibile pentru rolul tău.
            </p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Module disponibile</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {sections.map((section) => (
              <button key={section.route} type="button"
                onClick={() => router.push(section.route)}
                className="group relative overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${section.bg}`}>
                  {section.icon}
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-extrabold text-gray-900">{section.label}</h2>
                    {section.badge && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {section.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{section.sublabel}</p>
                </div>
                <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400 transition group-hover:bg-gray-200">
                  ›
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
