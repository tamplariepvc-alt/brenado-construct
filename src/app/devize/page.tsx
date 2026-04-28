"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Profile = {
  id: string;
  full_name: string;
  role: "administrator" | "cont_tehnic" | "project_manager" | "admin_limitat" | "sef_echipa" | "user";
};

type Estimate = {
  id: string;
  project_id: string | null;
  beneficiary: string;
  site_name: string;
  created_by: string;
  created_at: string;
};

type EstimateItem = {
  id: string;
  estimate_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
};

export default function DevizePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [search, setSearch] = useState("");

  // Ștergere
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles").select("id, full_name, role").eq("id", user.id).single();
    if (!profileData) { router.push("/login"); return; }

    const isFullAccess = ["administrator", "cont_tehnic", "project_manager"].includes(profileData.role);
    const estimatesQuery = isFullAccess
      ? supabase.from("estimates").select("id, project_id, beneficiary, site_name, created_by, created_at").order("created_at", { ascending: false })
      : supabase.from("estimates").select("id, project_id, beneficiary, site_name, created_by, created_at").eq("created_by", user.id).order("created_at", { ascending: false });

    const [estimatesRes, itemsRes] = await Promise.all([
      estimatesQuery,
      supabase.from("estimate_items").select("id, estimate_id, service_id, quantity, unit_price"),
    ]);

    setProfile(profileData as Profile);
    setEstimates((estimatesRes.data as Estimate[]) || []);
    setItems((itemsRes.data as EstimateItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [router]);

  const filteredEstimates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return estimates;
    return estimates.filter((e) =>
      e.beneficiary.toLowerCase().includes(q) || e.site_name.toLowerCase().includes(q)
    );
  }, [estimates, search]);

  const getEstimateTotal = (estimateId: string) =>
    items
      .filter((item) => item.estimate_id === estimateId)
      .reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("estimate_items").delete().eq("estimate_id", deleteId);
    await supabase.from("estimates").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    setEstimates((prev) => prev.filter((e) => e.id !== deleteId));
    setItems((prev) => prev.filter((i) => i.estimate_id !== deleteId));
  };

  const renderDevizIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-700 sm:h-7 sm:w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">{renderDevizIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-700" />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Se încarcă datele...</p>
              <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* MODAL CONFIRMARE ȘTERGERE */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-600" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-center text-lg font-bold text-gray-900">Ștergi acest deviz?</h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                Devizul și toate articolele sale vor fi șterse definitiv. Acțiunea nu poate fi anulată.
              </p>
              {(() => {
                const est = estimates.find((e) => e.id === deleteId);
                return est ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center">
                    <p className="text-sm font-bold text-red-800">{est.site_name}</p>
                    <p className="mt-0.5 text-xs text-red-600">{est.beneficiary}</p>
                  </div>
                ) : null;
              })()}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? "Se șterge..." : "Da, șterge"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Înapoi la dashboard
            </button>
            <button onClick={() => router.push("/devize/creeaza")}
              className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800">
              + Adaugă deviz
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
              {renderDevizIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Devize lucrări</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Istoric devize</h1>
              <p className="mt-1 text-sm text-gray-500">{profile?.full_name}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-green-700">{estimates.length}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-400">Total devize</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">
                {estimates.reduce((s, e) => s + getEstimateTotal(e.id), 0).toFixed(0)} lei
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Valoare totală</p>
            </div>
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută după beneficiar sau șantier..."
                className="h-full w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Devize — {filteredEstimates.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredEstimates.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              {search ? (
                <p className="text-sm text-gray-500">Nu există devize pentru căutarea introdusă.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">{renderDevizIcon()}</div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">Nu există devize încă</p>
                    <p className="mt-1 text-sm text-gray-500">Apasă pe „+ Adaugă deviz" pentru a crea primul deviz.</p>
                  </div>
                  <button onClick={() => router.push("/devize/creeaza")}
                    className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800">
                    + Adaugă deviz
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEstimates.map((estimate) => {
                const total = getEstimateTotal(estimate.id);
                const itemCount = items.filter((i) => i.estimate_id === estimate.id).length;

                return (
                  <div key={estimate.id} className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                    {/* Card clickabil */}
                    <button
                      type="button"
                      onClick={() => router.push(`/devize/${estimate.id}`)}
                      className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-[#FCFBF8] sm:p-5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-green-50">
                        {renderDevizIcon()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-900">{estimate.site_name}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{estimate.beneficiary}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(estimate.created_at).toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" })}
                          {" · "}{itemCount} {itemCount === 1 ? "articol" : "articole"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="text-xl font-extrabold text-green-700">{total.toFixed(2)} lei</p>
                        <span className="text-xs text-gray-400">›</span>
                      </div>
                    </button>

                    {/* Butoane acțiuni */}
                    <div className="flex items-center gap-2 border-t border-[#F0EEE9] px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => router.push(`/devize/${estimate.id}`)}
                        className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
                          <path d="M12 16V4M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M4 20h16" strokeLinecap="round" />
                        </svg>
                        Export PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteId(estimate.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Șterge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
	   <BottomNav />
    </div>
  );
}
