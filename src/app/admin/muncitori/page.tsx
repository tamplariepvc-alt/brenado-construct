"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Worker = {
  id: string;
  full_name: string;
  job_title: string | null;
  monthly_salary: number | null;
  is_active: boolean;
};

export default function MuncitoriPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    const loadWorkers = async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("id, full_name, job_title, monthly_salary, is_active")
        .order("full_name", { ascending: true });

      if (!error && data) {
        setWorkers(data as Worker[]);
      }

      setLoading(false);
    };

    loadWorkers();
  }, []);

if (loading) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-blue-600">
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Muncitori</h1>
            <p className="text-sm text-gray-600">
              Administrează muncitorii și salariile lunare.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Înapoi la panou admin
            </button>

            <button
              onClick={() => router.push("/admin/muncitori/adauga")}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              + Adaugă muncitor
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="grid grid-cols-[1fr_auto] border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <div>Nume</div>
            <div className="text-right">Acțiune</div>
          </div>

          {workers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Nu există muncitori înregistrați.
            </div>
          ) : (
            workers.map((worker) => (
              <div
                key={worker.id}
                className="grid grid-cols-[1fr_auto] items-start gap-4 border-b px-4 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900 break-words">
                    {worker.full_name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500 break-words">
                    {worker.job_title || "-"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Salariu:{" "}
                    <span className="font-medium text-gray-700">
                      {worker.monthly_salary != null
                        ? `${Number(worker.monthly_salary).toFixed(2)} lei`
                        : "-"}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      worker.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {worker.is_active ? "Activ" : "Inactiv"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/admin/muncitori/${worker.id}/edit`)
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Editează
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}