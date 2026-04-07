"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

            <Link
              href="/admin/muncitori/adauga"
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-center text-sm font-semibold text-white"
            >
              + Adaugă muncitor
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="grid grid-cols-[1.3fr_1fr_.9fr_auto] border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <div>Nume</div>
            <div>Funcție</div>
            <div>Status</div>
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
                className="grid grid-cols-[1.3fr_1fr_.9fr_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0"
              >
                <div className="font-medium break-words">{worker.full_name}</div>

                <div className="break-words">{worker.job_title || "-"}</div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      worker.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {worker.is_active ? "Activ" : "Inactiv"}
                  </span>
                </div>

                <div className="text-right">
                  <Link
                    href={`/admin/muncitori/${worker.id}/edit`}
                    className="inline-flex whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Editează
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}