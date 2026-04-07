"use client";

import { useEffect, useState } from "react";
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

  if (loading) {
    return <div className="p-6">Se încarcă centrele de cost...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Centre de cost</h1>
            <p className="text-sm text-gray-600">
              Toate proiectele marcate ca centre de cost.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la panou admin
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
<div className="grid grid-cols-3 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
  <div>Cod proiect</div>
  <div>Proiect</div>
  <div>Status</div>
</div>

{centres.length === 0 ? (
  <div className="px-4 py-6 text-sm text-gray-500">
    Nu există centre de cost.
  </div>
) : (
  centres.map((centre) => (
<button
  key={centre.id}
  type="button"
  onClick={() => router.push(`/admin/centre-de-cost/${centre.id}`)}
  className="grid w-full grid-cols-3 border-b px-4 py-3 text-left text-sm transition hover:bg-gray-50 last:border-b-0"
>
  <div className="font-semibold">
    {centre.cost_center_code || "-"}
  </div>
  <div>{centre.name}</div>
  <div>{getStatusLabel(centre.status)}</div>
</button>
  ))
)}
        </div>
      </div>
    </div>
  );
}