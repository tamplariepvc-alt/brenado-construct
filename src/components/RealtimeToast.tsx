"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ToastItem = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  removing: boolean;
};

const TYPE_STYLES = {
  info:    { bg: "bg-white", border: "border-blue-200",  icon: "text-blue-500",  title: "text-gray-900" },
  success: { bg: "bg-white", border: "border-green-200", icon: "text-green-500", title: "text-gray-900" },
  warning: { bg: "bg-white", border: "border-amber-200", icon: "text-amber-500", title: "text-gray-900" },
  error:   { bg: "bg-white", border: "border-red-200",   icon: "text-red-500",   title: "text-gray-900" },
};

const ToastIcon = ({ type }: { type: string }) => {
  const cls = "h-5 w-5 shrink-0";
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

export default function RealtimeToast() {
  const [userId, setUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isFirstMount = useRef(true);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Remove toast with fade-out
  const removeToast = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => t.id === id ? { ...t, removing: true } : t)
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userId) return;

    // Skip toasts that fire immediately on subscribe (existing rows)
    const warmupTimer = setTimeout(() => {
      isFirstMount.current = false;
    }, 1200);

    const channel = supabase
      .channel(`toast:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (isFirstMount.current) return;

          const notif = payload.new as {
            id: string; title: string; message: string;
            type: "info" | "success" | "warning" | "error";
          };

          const toastId = `toast-${notif.id}`;

          setToasts((prev) => [
            { id: toastId, title: notif.title, message: notif.message, type: notif.type, removing: false },
            ...prev.slice(0, 4), // max 5 toasts vizibile
          ]);

          // Auto-remove după 3.5s
          setTimeout(() => removeToast(toastId), 3500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(warmupTimer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed left-1/2 top-4 z-[9999] flex -translate-x-1/2 flex-col gap-2 px-4 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const styles = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg transition-all duration-300 ${styles.bg} ${styles.border} ${
              toast.removing ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
            }`}
          >
            <span className={`mt-0.5 ${styles.icon}`}>
              <ToastIcon type={toast.type} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-gray-300 transition hover:text-gray-500"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
