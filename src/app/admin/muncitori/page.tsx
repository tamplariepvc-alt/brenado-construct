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
    return <div className="p-6">Se încarcă muncitorii...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
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
          <div className="grid grid-cols-4 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <div>Nume</div>
            <div>Funcție</div>
            <div>Salariu lunar</div>
            <div>Status</div>
          </div>

          {workers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Nu există muncitori înregistrați.
            </div>
          ) : (
            workers.map((worker) => (
              <div
                key={worker.id}
                className="grid grid-cols-4 border-b px-4 py-3 text-sm last:border-b-0"
              >
                <div className="font-medium">{worker.full_name}</div>
                <div>{worker.job_title || "-"}</div>
                <div>
                  {worker.monthly_salary != null
                    ? `${Number(worker.monthly_salary).toFixed(2)} lei`
                    : "-"}
                </div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      worker.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {worker.is_active ? "Activ" : "Inactiv"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}