"use client";

import { useRouter, usePathname } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const navItems = [
    {
      label: "Acasă",
      path: "/dashboard",
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
          <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Proiecte",
      path: "/proiecte",
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path d="M6 8h12M6 12h12M6 16h8" strokeLinecap="round"
            strokeWidth={active ? 2.5 : 2} />
        </svg>
      ),
    },
    {
      label: "Notificări",
      path: "/notificari",
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
            strokeLinecap="round" strokeLinejoin="round"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Profil",
      path: "/profil",
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4"
            fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E8E5DE] bg-white/95 px-2 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                active ? "text-[#0196ff]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {item.icon(active)}
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">
                {item.label}
              </span>
              {active && (
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[#0196ff]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
