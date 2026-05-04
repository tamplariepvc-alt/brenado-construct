"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  // Load unread count + listen real-time
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Initial count
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      setUnreadCount(count || 0);

      // Real-time updates
      channel = supabase
        .channel(`bottomnav:${userId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        }, () => {
          setUnreadCount((prev) => prev + 1);
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        }, () => {
          // Recalculate on update (mark read)
          supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId!)
            .eq("is_read", false)
            .then(({ count }) => setUnreadCount(count || 0));
        })
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

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
      badge,
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
              className={`relative flex flex-col items-center gap-1 py-1 transition ${
                active ? "text-[#0196ff]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className="relative">
                {item.icon(active)}
                {"badge" in item && item.badge && (
                  <span className="absolute -right-2 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 py-px text-[9px] font-bold text-white leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
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
