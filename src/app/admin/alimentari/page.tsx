"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type FundingRow = {
  id: string;
  project_id: string;
  amount_ron: number | null;
  funding_type: "card" | "cont";
  funding_date: string;
  notes: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    beneficiary: string | null;
  }[] | null;
  profiles?: {
    id: string;
    full_name: string;
  }[] | null;
};

export default function AlimentariPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fundings, setFundings] = useState<FundingRow[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("project_fundings")
        .select(`
          id,
          project_id,
          amount_ron,
          funding_type,
          funding_date,
          notes,
          created_at,
          projects:project_id (
            id,
            name,
            beneficiary
          ),
          profiles:team_lead_user_id (
            id,
            full_name
          )
        `)
        .order("funding_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFundings((data as unknown as FundingRow[]) || []);
      } else {
        setFundings([]);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const totals = useMemo(() => {
    return fundings.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.total += Number(row.amount_ron || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [fundings]);

  const getFundingTypeLabel = (type: string) => {
    if (type === "card") return "Card";
    if (type === "cont") return "Cont";
    return type;
  };

  if (loading) {
    return <div className="p-6">Se încarcă alimentările...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alimentare Carduri / Conturi</h1>
            <p className="text-sm text-gray-600">
              Gestionează alimentările proiectelor și istoricul lor.
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
              onClick={() => router.push("/admin/alimentari/adauga")}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Alimentare Card / Cont
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total alimentări</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totals.count}
            </p>
          </div>

          <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
            <p className="text-sm text-white/80">Valoare totală alimentată</p>
            <p className="mt-2 text-3xl font-bold">
              {totals.total.toFixed(2)} lei
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            <div className="col-span-3">Proiect</div>
            <div className="col-span-2">Șef șantier</div>
            <div className="col-span-2">Tip</div>
            <div className="col-span-2">Sumă</div>
            <div className="col-span-2">Data</div>
            <div className="col-span-1">Detalii</div>
          </div>

          {fundings.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Nu există alimentări înregistrate.
            </div>
          ) : (
            fundings.map((row) => {
              const project = row.projects?.[0] || null;
              const lead = row.profiles?.[0] || null;

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="col-span-3">
                    <p className="font-semibold text-gray-900">
                      {project?.name || "-"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {project?.beneficiary || "-"}
                    </p>
                  </div>

                  <div className="col-span-2">
                    {lead?.full_name || "-"}
                  </div>

                  <div className="col-span-2">
                    {getFundingTypeLabel(row.funding_type)}
                  </div>

                  <div className="col-span-2 font-semibold">
                    {Number(row.amount_ron || 0).toFixed(2)} lei
                  </div>

                  <div className="col-span-2">
                    {row.funding_date
                      ? new Date(row.funding_date).toLocaleDateString("ro-RO")
                      : "-"}
                  </div>

                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/alimentari/${row.id}`)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                    >
                      Vezi
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}