"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import BottomNav from "@/components/BottomNav";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_STYLES = {
  info:    { dot: "bg-blue-500",  icon: "text-blue-500",  bg: "bg-blue-50"  },
  success: { dot: "bg-green-500", icon: "text-green-500", bg: "bg-green-50" },
  warning: { dot: "bg-amber-500", icon: "text-amber-500", bg: "bg-amber-50" },
  error:   { dot: "bg-red-500",   icon: "text-red-500",   bg: "bg-red-50"   },
};

const NotifIcon = ({ type }: { type: string }) => {
  const cls = "h-5 w-5";
  if (type === "success") return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === "warning") return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </svg>
  );
  if (type === "error") return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
};

export default function NotificariPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  const loadNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, link, is_read, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data as Notification[]) || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      await loadNotifications(user.id);
      setLoading(false);
    };
    init();
  }, [router, loadNotifications]);

  // Real-time: new notification comes in
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notificari-page:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleMarkAll = async () => {
    if (!userId) return;
    setMarkingAll(true);
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
      );
    }
    if (notif.link) router.push(notif.link);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "Acum";
    if (diffMin < 60) return `${diffMin} min în urmă`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h în urmă`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} zile în urmă`;
    return date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  };

  const groupByDate = (notifs: Notification[]) => {
    const groups: { label: string; items: Notification[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const map = new Map<string, Notification[]>();
    notifs.forEach((n) => {
      const d = new Date(n.created_at);
      let key: string;
      if (d.toDateString() === today) key = "Astăzi";
      else if (d.toDateString() === yesterday) key = "Ieri";
      else key = d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });

    map.forEach((items, label) => groups.push({ label, items }));
    return groups;
  };

  const groups = groupByDate(notifications);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex items-center gap-3">
            {badge && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {badge} necitite
              </span>
            )}
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAll} disabled={markingAll}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">
                {markingAll ? "..." : "Marchează tot ca citit"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contul tău</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Notificări</h1>
              <p className="mt-2 text-sm text-gray-500">
                {notifications.length === 0 ? "Nu ai notificări." : `${notifications.length} notificări · ${unreadCount} necitite`}
              </p>
            </div>
          </div>
        </section>

        {/* List */}
        <div className="mt-4 space-y-4">
          {groups.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-10 text-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="mx-auto h-12 w-12 text-gray-200" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
              </svg>
              <p className="mt-4 text-sm font-semibold text-gray-400">Nu ai notificări momentan</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 flex items-center gap-3 px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">{group.label}</p>
                  <div className="h-px flex-1 bg-[#E8E5DE]" />
                </div>
                <div className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                  {group.items.map((notif, idx) => {
                    const styles = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
                    return (
                      <button key={notif.id} type="button" onClick={() => handleClick(notif)}
                        className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[#FAFAF8] ${
                          !notif.is_read ? "bg-blue-50/30" : ""
                        } ${idx < group.items.length - 1 ? "border-b border-[#F0EEE9]" : ""}`}>
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.bg} ${styles.icon}`}>
                          <NotifIcon type={notif.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold leading-5 ${!notif.is_read ? "text-gray-900" : "text-gray-600"}`}>
                              {notif.title}
                            </p>
                            <span className="shrink-0 text-[10px] text-gray-400 mt-0.5">{formatTime(notif.created_at)}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{notif.message}</p>
                          {notif.link && (
                            <p className="mt-1 text-[11px] font-medium text-[#0196ff]">Apasă pentru detalii →</p>
                          )}
                        </div>
                        {!notif.is_read && (
                          <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
