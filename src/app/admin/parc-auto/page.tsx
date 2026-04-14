"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

type VehicleStatus =
  | "activa"
  | "inactiva"
  | "in_reparatie";

type Vehicle = {
  id: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  registration_number: string;
  rca_valid_until: string | null;
  itp_valid_until: string | null;
  status: VehicleStatus;
  is_leasing: boolean;
};

export default function ParcAutoPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("toate");

  const today = new Date();

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const getDaysUntil = (date: string | null) => {
    const d = parseDate(date);
    if (!d) return null;
    const diff = d.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const loadVehicles = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    setVehicles((data as Vehicle[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const getComputedStatus = (v: Vehicle) => {
    const rcaExpired = getDaysUntil(v.rca_valid_until) ?? 999 < 0;
    const itpExpired = getDaysUntil(v.itp_valid_until) ?? 999 < 0;

    if (rcaExpired || itpExpired) return "doc_expirate";

    return v.status;
  };

  const getStatusLabel = (status: string) => {
    if (status === "activa") return "Activa";
    if (status === "inactiva") return "Inactiva";
    if (status === "in_reparatie") return "In reparatie";
    if (status === "doc_expirate") return "Doc. expirate";
    return status;
  };

  const getStatusClasses = (status: string) => {
    if (status === "activa") return "bg-green-100 text-green-700";
    if (status === "in_reparatie") return "bg-orange-100 text-orange-700";
    if (status === "doc_expirate") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const getWarnings = (v: Vehicle) => {
    const list: string[] = [];

    const rca = getDaysUntil(v.rca_valid_until);
    const itp = getDaysUntil(v.itp_valid_until);

    if (rca !== null && rca >= 0 && rca <= 30) {
      list.push(`Expira RCA in ${rca} zile`);
    }

    if (itp !== null && itp >= 0 && itp <= 30) {
      list.push(`Expira ITP in ${itp} zile`);
    }

    return list;
  };

  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];

    if (search.trim()) {
      return list.filter(
        (v) =>
          v.brand.toLowerCase().includes(search.toLowerCase()) ||
          v.model.toLowerCase().includes(search.toLowerCase()) ||
          v.registration_number.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filter === "leasing") {
      list = list.filter((v) => v.is_leasing);
    }

    if (filter === "doc_expirate") {
      list = list.filter((v) => getComputedStatus(v) === "doc_expirate");
    }

    if (filter === "expira") {
      list = list.filter((v) => getWarnings(v).length > 0);
    }

    if (filter === "activa") {
      list = list.filter((v) => getComputedStatus(v) === "activa");
    }

    if (filter === "in_reparatie") {
      list = list.filter((v) => getComputedStatus(v) === "in_reparatie");
    }

    return list;
  }, [vehicles, search, filter]);

  if (loading) {
    return <div className="p-6">Se incarca...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-5xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold">Parc Auto</h1>
        </div>

        <button
          onClick={() => router.push("/admin/parc-auto/adauga")}
          className="w-full rounded-xl bg-[#0196ff] py-3 text-white font-semibold"
        >
          + Adauga auto
        </button>

        {/* FILTRE */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter("toate")} className="badge">Toate</button>
          <button onClick={() => setFilter("activa")} className="badge bg-green-100">Active</button>
          <button onClick={() => setFilter("in_reparatie")} className="badge bg-orange-100">In reparatie</button>
          <button onClick={() => setFilter("doc_expirate")} className="badge bg-red-100">Doc expirate</button>
          <button onClick={() => setFilter("expira")} className="badge bg-gray-200">Urmeaza sa expire</button>
          <button onClick={() => setFilter("leasing")} className="badge bg-purple-100">Leasing</button>
        </div>

        {/* SEARCH */}
        <input
          placeholder="Cauta model sau nr..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border px-4 py-3"
        />

        {/* LISTA */}
        <div className="space-y-3">
          {filteredVehicles.map((v) => {
            const status = getComputedStatus(v);
            const warnings = getWarnings(v);

            return (
              <div
                key={v.id}
                onClick={() => router.push(`/admin/parc-auto/${v.id}`)}
                className="rounded-xl bg-white p-4 shadow flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-semibold">
                    {v.brand} {v.model}
                  </p>
                  <p className="text-sm text-gray-500">
                    {v.registration_number}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`badge ${getStatusClasses(status)}`}>
                      {getStatusLabel(status)}
                    </span>

                    {v.is_leasing && (
                      <span className="badge bg-purple-100 text-purple-700">
                        Leasing
                      </span>
                    )}

                    {warnings.map((w) => (
                      <span key={w} className="badge bg-yellow-100 text-yellow-800">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                {/* SAGEATA */}
                <div className="text-3xl text-gray-400">›</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STYLE BADGE */}
      <style jsx>{`
        .badge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}