"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type UserProfile = {
  id: string;
  full_name: string;
  role: string;
  email?: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

const ROLES = [
  { value: "administrator", label: "Administrator", color: "bg-slate-100 text-slate-700", desc: "Acces complet la toate modulele" },
  { value: "cont_tehnic", label: "Cont tehnic", color: "bg-slate-100 text-slate-700", desc: "Acces complet (identic cu administrator)" },
  { value: "project_manager", label: "Project Manager", color: "bg-blue-100 text-blue-700", desc: "Proiecte, devize, comenzi, pontaj, echipe" },
  { value: "admin_limitat", label: "Cont de administrare limitat", color: "bg-orange-100 text-orange-700", desc: "Vizualizare proiecte/comenzi, modul admin parțial" },
  { value: "sef_echipa", label: "Șef de echipă", color: "bg-green-100 text-green-700", desc: "Pontaj, comenzi proprii, devize proprii" },
  { value: "user", label: "Utilizator", color: "bg-gray-100 text-gray-600", desc: "Acces minimal" },
];

export default function UtilizatoriPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null); // user id

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = async () => {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (!profilesData) return;

    // Fetch email-uri din auth.users via RPC sau fallback fara email
    setUsers((profilesData as UserProfile[]) || []);

    const initRoles: Record<string, string> = {};
    (profilesData as UserProfile[]).forEach((u) => {
      initRoles[u.id] = u.role;
    });
    setEditingRole(initRoles);
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || !["administrator", "cont_tehnic"].includes(profile.role)) {
        router.push("/dashboard"); return;
      }
      await loadUsers();
      setLoading(false);
    };
    checkAndLoad();
  }, [router]);

  const handleSaveRole = async (userId: string) => {
    const newRole = editingRole[userId];
    setSavingId(userId);

    const { error } = await supabase.from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      showToast("error", `Eroare: ${error.message}`);
    } else {
      showToast("success", "Rol actualizat cu succes.");
      await loadUsers();
    }

    setSavingId(null);
    setShowRoleModal(null);
  };

  const getRoleInfo = (roleValue: string) =>
    ROLES.find((r) => r.value === roleValue) || { label: roleValue, color: "bg-gray-100 text-gray-600", desc: "" };

  const filteredUsers = users.filter((u) =>
    !search.trim() || u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-violet-600 sm:h-7 sm:w-7">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="8" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19 6v2l1 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-50">{renderIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-violet-600" />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Se încarcă utilizatorii...</p>
              <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${
            toast.type === "success" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"
          }`}>
            {toast.type === "success"
              ? <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-600" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
            }
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      {/* MODAL SCHIMBARE ROL */}
      {showRoleModal && (() => {
        const user = users.find((u) => u.id === showRoleModal);
        if (!user) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-4">
            <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Schimbă rolul pentru</p>
                    <p className="text-base font-bold text-gray-900">{user.full_name}</p>
                  </div>
                  <button type="button" onClick={() => setShowRoleModal(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">✕</button>
                </div>

                <div className="space-y-2">
                  {ROLES.map((role) => {
                    const isSelected = editingRole[user.id] === role.value;
                    return (
                      <button key={role.value} type="button"
                        onClick={() => setEditingRole((prev) => ({ ...prev, [user.id]: role.value }))}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}>
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "border-violet-600" : "border-gray-300"
                        }`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-violet-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{role.label}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{role.desc}</p>
                        </div>
                        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${role.color}`}>
                          {role.label.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => handleSaveRole(user.id)} disabled={savingId === user.id}
                    className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                    {savingId === user.id ? "Se salvează..." : "Salvează rolul"}
                  </button>
                  <button type="button" onClick={() => setShowRoleModal(null)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Anulează
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        {/* Header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-violet-50 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Utilizatori</h1>
              <p className="mt-2 text-sm text-gray-500">
                Gestionează conturile și rolurile utilizatorilor aplicației.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
              {users.length} conturi
            </span>
          </div>

          <div className="mt-5">
            <input type="text" placeholder="Caută după nume..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
          </div>

          {/* Legenda roluri */}
          <div className="mt-4 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <span key={r.value} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.color}`}>
                {r.label}
              </span>
            ))}
          </div>
        </section>

        {/* Lista utilizatori */}
        <section className="mt-6 space-y-3">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Conturi — {filteredUsers.length}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Nu există utilizatori pentru căutarea introdusă.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const roleInfo = getRoleInfo(user.role);
              return (
                <div key={user.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-violet-50">
                        <span className="text-base font-extrabold text-violet-600">
                          {user.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{user.full_name}</p>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setShowRoleModal(user.id)}
                      className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100">
                      Schimbă rol
                    </button>
                  </div>
                  <p className="mt-2 pl-14 text-xs text-gray-400">{roleInfo.desc}</p>
                </div>
              );
            })
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
