"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

type VehicleStatus = "activa" | "inactiva" | "in_reparatie";

type Vehicle = {
  id: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  registration_number: string;
  rca_valid_until: string | null;
  itp_valid_until: string | null;
  is_leasing: boolean;
  status: VehicleStatus;
};

type FilterType =
  | "toate"
  | "active"
  | "inactive"
  | "in_reparatie"
  | "doc_expirate"
  | "urmeaza_sa_expire"
  | "leasing";

export default function ParcAutoPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("toate");

  const [openSections, setOpenSections] = useState({
    camion: false,
    autoutilitara: false,
    microbuz: false,
    masina_administrativa: false,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("vehicles").select("*");
      setVehicles(data || []);
    };

    load();
  }, []);

  const today = new Date();

  const parseDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00") : null;

  const getDays = (d: string | null) => {
    const date = parseDate(d);
    if (!date) return null;
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  };

  const getStatus = (v: Vehicle) => {
    const rca = parseDate(v.rca_valid_until);
    const itp = parseDate(v.itp_valid_until);

    if (
      (rca && rca < today) ||
      (itp && itp < today)
    ) {
      return "doc_expirate";
    }

    return v.status;
  };

  const getWarnings = (v: Vehicle) => {
    const list: string[] = [];

    const rca = getDays(v.rca_valid_until);
    const itp = getDays(v.itp_valid_until);

    if (rca !== null && rca >= 0 && rca <= 30) {
      list.push(`Expira RCA in ${rca} zile`);
    }

    if (itp !== null && itp >= 0 && itp <= 30) {
      list.push(`Expira ITP in ${itp} zile`);
    }

    return list;
  };

  const isExpiring = (v: Vehicle) =>
    getWarnings(v).length > 0 && getStatus(v) !== "doc_expirate";

  const stats = useMemo(() => {
    return {
      total: vehicles.length,
      active: vehicles.filter(v => getStatus(v) === "activa").length,
      inactive: vehicles.filter(v => getStatus(v) === "inactiva").length,
      inRepair: vehicles.filter(v => getStatus(v) === "in_reparatie").length,
      expired: vehicles.filter(v => getStatus(v) === "doc_expirate").length,
      expiring: vehicles.filter(v => isExpiring(v)).length,
      leasing: vehicles.filter(v => v.is_leasing).length,
    };
  }, [vehicles]);

  const filterCounts = {
    toate: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    in_reparatie: stats.inRepair,
    doc_expirate: stats.expired,
    urmeaza_sa_expire: stats.expiring,
    leasing: stats.leasing,
  };

  const filtered = vehicles.filter(v => {
    const status = getStatus(v);

    if (filter === "active" && status !== "activa") return false;
    if (filter === "inactive" && status !== "inactiva") return false;
    if (filter === "in_reparatie" && status !== "in_reparatie") return false;
    if (filter === "doc_expirate" && status !== "doc_expirate") return false;
    if (filter === "urmeaza_sa_expire" && !isExpiring(v)) return false;
    if (filter === "leasing" && !v.is_leasing) return false;

    const txt = `${v.brand} ${v.model} ${v.registration_number}`.toLowerCase();
    return txt.includes(search.toLowerCase());
  });

  const grouped = {
    camion: filtered.filter(v => v.category === "camion"),
    autoutilitara: filtered.filter(v => v.category === "autoutilitara"),
    microbuz: filtered.filter(v => v.category === "microbuz"),
    masina_administrativa: filtered.filter(v => v.category === "masina_administrativa"),
  };

  const badge = "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold";

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Parc Auto</h1>

      <button
        onClick={() => router.push("/admin/parc-auto/adauga")}
        className="w-full bg-[#0196ff] text-white py-4 rounded-xl mb-5 font-semibold"
      >
        + Adauga auto
      </button>

      {/* FILTRE */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["toate", "Toate"],
          ["active", "Active"],
          ["inactive", "Inactive"],
          ["in_reparatie", "In reparatie"],
          ["doc_expirate", "Doc expirate"],
          ["urmeaza_sa_expire", "Urmeaza sa expire"],
          ["leasing", "Leasing"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as FilterType)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-sm"
          >
            {label}
            <span className={badge}>
              {filterCounts[key as keyof typeof filterCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <input
        className="w-full border-2 rounded-xl px-4 py-3 mb-5"
        placeholder="Cauta model sau nr..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* SECTIUNI */}
      {Object.entries(grouped).map(([key, list]) => (
        <div key={key} className="bg-white rounded-2xl mb-4 shadow">
          <button
            onClick={() =>
              setOpenSections(prev => ({
                ...prev,
                [key]: !prev[key as keyof typeof prev],
              }))
            }
            className="w-full flex justify-between p-5"
          >
            <div>
              <h2 className="font-bold text-lg">{key}</h2>
              <p className="text-sm text-gray-500">{list.length} vehicule</p>
            </div>

            <span className="text-2xl">
              {openSections[key as keyof typeof openSections] ? "-" : "+"}
            </span>
          </button>

          {openSections[key as keyof typeof openSections] && (
            <div className="p-3 space-y-3 border-t">
              {list.map(v => {
                const status = getStatus(v);
                const warnings = getWarnings(v);

                return (
                  <div
                    key={v.id}
                    onClick={() => router.push(`/admin/parc-auto/${v.id}`)}
                    className="p-4 rounded-xl bg-gray-50 flex justify-between cursor-pointer"
                  >
                    <div>
                      <p className="font-bold">{v.brand} {v.model}</p>
                      <p className="text-gray-500">{v.registration_number}</p>

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                          {status}
                        </span>

                        {warnings.map(w => (
                          <span key={w} className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>

                    <span className="text-2xl text-gray-400">›</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}