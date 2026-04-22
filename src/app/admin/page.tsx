"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminPage() {
  const router = useRouter();
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    const loadUnpaidCount = async () => {
      const { data, error } = await supabase
        .from("extra_work")
        .select("id, extra_hours, weekend_days_count, extra_hours_paid, weekend_paid");

      if (error || !data) {
        setUnpaidCount(0);
        return;
      }

      const count = data.filter((row) => {
        const hasExtra = Number(row.extra_hours || 0) > 0;
        const hasWeekend = Number(row.weekend_days_count || 0) > 0;

        const extraUnpaid = hasExtra && !row.extra_hours_paid;
        const weekendUnpaid = hasWeekend && !row.weekend_paid;

        return extraUnpaid || weekendUnpaid;
      }).length;

      setUnpaidCount(count);
    };

    loadUnpaidCount();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panou Admin</h1>
            <p className="text-sm text-gray-600">
              Gestionare date si module administrative.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Inapoi la dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <button
            onClick={() => router.push("/admin/centre-de-cost")}
            className="rounded-2xl bg-white p-6 text-left shadow transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">Centre de cost</h2>
            <p className="mt-1 text-sm text-gray-500">
              Vezi toate proiectele si costurile aferente.
            </p>
          </button>

          <button
            onClick={() => router.push("/admin/muncitori")}
            className="rounded-2xl bg-white p-6 text-left shadow transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">Muncitori</h2>
            <p className="mt-1 text-sm text-gray-500">
              Gestioneaza muncitorii si salariile lunare.
            </p>
          </button>

          <button
            onClick={() => router.push("/admin/parc-auto")}
            className="rounded-2xl bg-white p-6 text-left shadow transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">Parc Auto</h2>
            <p className="mt-1 text-sm text-gray-500">
              Gestioneaza vehiculele firmei, documentele si leasingul.
            </p>
          </button>

          <button
            onClick={() => router.push("/admin/ore-extra")}
            className="relative rounded-2xl bg-[#0196ff] p-6 text-left text-white shadow transition hover:opacity-90"
          >
            {unpaidCount > 0 && (
              <span className="absolute right-4 top-4 inline-flex min-w-[28px] items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                {unpaidCount}
              </span>
            )}

            <h2 className="text-lg font-semibold">Ore Extra + Weekend</h2>
            <p className="mt-1 text-sm text-white/80">
              Vezi, filtreaza, achita si exporta rapoartele pentru ore extra si weekend.
            </p>
          </button>

          {/* 🔵 BUTON NOU */}
          <button
            onClick={() => router.push("/admin/alimentari")}
            className="rounded-2xl bg-green-600 p-6 text-left text-white shadow transition hover:opacity-90"
          >
            <h2 className="text-lg font-semibold">Alimentare Carduri / Conturi</h2>
            <p className="mt-1 text-sm text-white/80">
              Alimenteaza proiectele si vezi istoricul alimentărilor.
            </p>
          </button>

        </div>
      </div>
    </div>
  );
}