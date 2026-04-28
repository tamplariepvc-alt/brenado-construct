"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Worker = {
  id: string;
  full_name: string;
  job_title: string | null;
  monthly_salary: number | null;
  is_active: boolean;
  worker_type: "executie" | "tesa";
};

type CategoryTab = "executie" | "tesa";

export default function PersonalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CategoryTab>("executie");
  const [filterActive, setFilterActive] = useState<"toti" | "activi" | "inactivi">("toti");

  useEffect(() => {
    const loadWorkers = async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("id, full_name, job_title, monthly_salary, is_active, worker_type")
        .order("full_name", { ascending: true });

      if (!error && data) setWorkers(data as Worker[]);
      setLoading(false);
    };

    loadWorkers();
  }, []);

  // Muncitorii din categoria activa
  const categoryWorkers = useMemo(() => {
    return workers.filter((w) => {
      // Daca nu are worker_type setat, e considerat executie
      const type = w.worker_type || "executie";
      return type === activeTab;
    });
  }, [workers, activeTab]);

  const filteredWorkers = useMemo(() => {
    return categoryWorkers.filter((w) => {
      const matchSearch =
        !search.trim() ||
        w.full_name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (w.job_title || "").toLowerCase().includes(search.trim().toLowerCase());

      const matchActive =
        filterActive === "toti" ||
        (filterActive === "activi" && w.is_active) ||
        (filterActive === "inactivi" && !w.is_active);

      return matchSearch && matchActive;
    });
  }, [categoryWorkers, search, filterActive]);

  const stats = useMemo(() => ({
    total: categoryWorkers.length,
    activi: categoryWorkers.filter((w) => w.is_active).length,
    inactivi: categoryWorkers.filter((w) => !w.is_active).length,
  }), [categoryWorkers]);

  // Totale globale pentru badge-uri tab
  const tabCounts = useMemo(() => ({
    executie: workers.filter((w) => (w.worker_type || "executie") === "executie").length,
    tesa: workers.filter((w) => w.worker_type === "tesa").length,
  }), [workers]);

  const renderWorkerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
              {renderWorkerIcon()}
            </div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
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
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la admin
            </button>
            <button
              onClick={() => router.push("/admin/muncitori/adauga")}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Adaugă
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderWorkerIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Personal
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Administrează personalul, funcțiile și salariile lunare.
              </p>
            </div>
          </div>

          {/* Tab-uri categorie */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab("executie"); setFilterActive("toti"); setSearch(""); }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === "executie"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Personal de execuție
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "executie" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {tabCounts.executie}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("tesa"); setFilterActive("toti"); setSearch(""); }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === "tesa"
                  ? "bg-[#0196ff] text-white"
                  : "bg-[#0196ff]/10 text-[#0196ff] hover:bg-[#0196ff]/20"
              }`}
            >
              TESA
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "tesa" ? "bg-white/20 text-white" : "bg-[#0196ff]/20 text-[#0196ff]"
              }`}>
                {tabCounts.tesa}
              </span>
            </button>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setFilterActive("toti")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${
                filterActive === "toti"
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-transparent bg-blue-50"
              }`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">
                {stats.total}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Toți
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterActive("activi")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${
                filterActive === "activi"
                  ? "border-green-400 bg-green-50 ring-2 ring-green-200"
                  : "border-transparent bg-green-50"
              }`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">
                {stats.activi}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">
                Activi
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterActive("inactivi")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${
                filterActive === "inactivi"
                  ? "border-gray-400 bg-gray-100 ring-2 ring-gray-200"
                  : "border-transparent bg-gray-100"
              }`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-gray-600 sm:text-3xl">
                {stats.inactivi}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                Inactivi
              </p>
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              placeholder={`Caută în ${activeTab === "tesa" ? "TESA" : "Personal de execuție"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />
          </div>
        </section>

        {/* Lista */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {activeTab === "tesa" ? "TESA" : "Personal de execuție"} — {filteredWorkers.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredWorkers.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există personal pentru criteriile selectate.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-4">Nume</div>
                  <div className="col-span-3">Funcție</div>
                  <div className="col-span-2">Salariu</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1"></div>
                </div>

                {filteredWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="grid grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 last:border-b-0"
                  >
                    <div className="col-span-4 text-sm font-semibold text-gray-900">
                      {worker.full_name}
                    </div>
                    <div className="col-span-3 text-sm text-gray-500">
                      {worker.job_title || "-"}
                    </div>
                    <div className="col-span-2 text-sm font-semibold text-gray-900">
                      {worker.monthly_salary != null
                        ? `${Number(worker.monthly_salary).toFixed(2)} lei`
                        : "-"}
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                        worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {worker.is_active ? "Activ" : "Inactiv"}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/muncitori/${worker.id}/edit`)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Editează
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {filteredWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                          {renderWorkerIcon()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-gray-900">{worker.full_name}</p>
                          <p className="mt-0.5 text-sm text-gray-500">{worker.job_title || "-"}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {worker.is_active ? "Activ" : "Inactiv"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Salariu lunar</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {worker.monthly_salary != null
                            ? `${Number(worker.monthly_salary).toFixed(2)} lei`
                            : "-"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/muncitori/${worker.id}/edit`)}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Editează
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
 <BottomNav />
    </div>
  );
}
