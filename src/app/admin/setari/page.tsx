"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SetariPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "administrator") { router.push("/dashboard"); return; }
      setLoading(false);
    };
    check();
  }, [router]);

  const sections = [
    {
      key: "servicii",
      href: "/admin/setari/servicii",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#0196ff]">
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      bg: "bg-[#0196ff]/8",
      title: "Servicii deviz",
      description: "Gestionează serviciile disponibile în devizul zilnic completat de șefii de echipă. Poți adăuga, edita prețuri și activa sau dezactiva servicii.",
      badge: "Devize",
      badgeClasses: "bg-[#0196ff]/10 text-[#0196ff]",
    },
    {
      key: "materiale",
      href: "/admin/setari/materiale",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-orange-600">
          <path d="M4 6h2l1.4 6.5h8.8L18 8H8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="18" r="1.5" fill="currentColor" />
          <circle cx="17" cy="18" r="1.5" fill="currentColor" />
        </svg>
      ),
      bg: "bg-orange-50",
      title: "Articole comenzi",
      description: "Gestionează catalogul de articole disponibile la crearea comenzilor de materiale. Poți adăuga articole noi, edita prețuri și TVA.",
      badge: "Comenzi",
      badgeClasses: "bg-orange-100 text-orange-700",
    },
  ];

  const renderSettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-gray-600 sm:h-7 sm:w-7">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-100">{renderSettingsIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-gray-100 sm:h-14 sm:w-14">
              {renderSettingsIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Alte setări</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                Selectează modulul pe care vrei să îl configurezi.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Module disponibile</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => router.push(section.href)}
                className="group relative overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${section.bg}`}>
                  {section.icon}
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-gray-900">{section.title}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${section.badgeClasses}`}>
                      {section.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{section.description}</p>
                </div>
                <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400 transition group-hover:bg-gray-200">
                  ›
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
