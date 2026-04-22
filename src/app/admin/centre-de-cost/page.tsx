"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type CostCenter = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  status: string;
  cost_center_code: string | null;
  is_cost_center: boolean;
};

export default function CentreDeCostPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [centres, setCentres] = useState<CostCenter[]>([]);

  useEffect(() => {
    const loadCentres = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          beneficiary,
          project_location,
          status,
          cost_center_code,
          is_cost_center
        `)
        .eq("is_cost_center", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCentres(data as CostCenter[]);
      }

      setLoading(false);
    };

    loadCentres();
  }, []);

  const getStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getStatusStyle = (status: string) => {
    if (status === "in_asteptare") {
      return "bg-blue-100 text-blue-800";
    }

    if (status === "in_lucru") {
      return "bg-yellow-100 text-yellow-800";
    }

    if (status === "finalizat") {
      return "bg-green-100 text-green-800";
    }

    return "bg-gray-100 text-gray-800";
  };

  const totals = useMemo(() => {
    return {
      total: centres.length,
      inAsteptare: centres.filter((item) => item.status === "in_asteptare").length,
      inLucru: centres.filter((item) => item.status === "in_lucru").length,
      finalizate: centres.filter((item) => item.status === "finalizat").length,
    };
  }, [centres]);

  const renderCenterIcon = () => {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
        <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="10" width="7" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  };

  if (loading) {
    return <div className="p-6">Se încarcă centrele de cost...</div>;
  }

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
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la panou admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Modul administrativ</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Centre de cost
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Toate proiectele marcate ca centre de cost.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-2xl bg-blue-50 px-3 py-3 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">
                {totals.total}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Total
              </p>
            </div>

            <div className="rounded-2xl bg-sky-50 px-3 py-3 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-sky-600 sm:text-3xl">
                {totals.inAsteptare}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                În așteptare
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 px-3 py-3 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-amber-600 sm:text-3xl">
                {totals.inLucru}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                În lucru
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 px-3 py-3 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">
                {totals.finalizate}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">
                Finalizate
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista centrelor de cost
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {centres.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Nu există centre de cost.</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-2">Cod proiect</div>
                  <div className="col-span-4">Proiect</div>
                  <div className="col-span-3">Beneficiar</div>
                  <div className="col-span-2">Locație</div>
                  <div className="col-span-1">Status</div>
                </div>

                {centres.map((centre) => (
                  <button
                    key={centre.id}
                    type="button"
                    onClick={() => router.push(`/admin/centre-de-cost/${centre.id}`)}
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-2 text-sm font-semibold text-gray-900">
                      {centre.cost_center_code || "-"}
                    </div>

                    <div className="col-span-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                        {renderCenterIcon()}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {centre.name}
                      </p>
                    </div>

                    <div className="col-span-3 text-sm text-gray-500">
                      {centre.beneficiary || "-"}
                    </div>

                    <div className="col-span-2 text-sm text-gray-500">
                      {centre.project_location || "-"}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                          centre.status
                        )}`}
                      >
                        {getStatusLabel(centre.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 lg:hidden">
                {centres.map((centre) => (
                  <button
                    key={centre.id}
                    type="button"
                    onClick={() => router.push(`/admin/centre-de-cost/${centre.id}`)}
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderCenterIcon()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900">
                              {centre.name}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                              {centre.cost_center_code || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                          centre.status
                        )}`}
                      >
                        {getStatusLabel(centre.status)}
                      </span>
                    </div>

                    <div className="mt-4 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Beneficiar
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {centre.beneficiary || "-"}
                      </p>
                    </div>

                    <div className="mt-3 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Locație
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {centre.project_location || "-"}
                      </p>
                    </div>

                    <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}