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

const categoryLabels = {
  camion: "Camioane",
  autoutilitara: "Autoutilitare",
  microbuz: "Microbuze",
  masina_administrativa: "Masini Administrative",
};

export default function ParcAutoPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [openSections, setOpenSections] = useState({
    camion: false,
    autoutilitara: false,
    microbuz: false,
    masina_administrativa: false,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .order("category");

      setVehicles((data as Vehicle[]) || []);
      setLoading(false);
    };

    load();
  }, []);

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const today = new Date();

  const getStatus = (v: Vehicle) => {
    const rca = parseDate(v.rca_valid_until);
    const itp = parseDate(v.itp_valid_until);

    if ((rca && rca < today) || (itp && itp < today)) {
      return "doc_expirate";
    }

    return v.status;
  };

  const getWarnings = (v: Vehicle) => {
    const list: string[] = [];

    const rca = parseDate(v.rca_valid_until);
    const itp = parseDate(v.itp_valid_until);

    const days = (d: Date) =>
      Math.ceil((d.getTime() - today.getTime()) / 86400000);

    if (rca) {
      const d = days(rca);
      if (d >= 0 && d <= 30) list.push(`Expira RCA in ${d} zile`);
    }

    if (itp) {
      const d = days(itp);
      if (d >= 0 && d <= 30) list.push(`Expira ITP in ${d} zile`);
    }

    return list;
  };

  const getStatusStyle = (s: string) => {
    if (s === "activa") return "bg-green-100 text-green-700";
    if (s === "inactiva") return "bg-gray-100 text-gray-700";
    if (s === "in_reparatie") return "bg-orange-100 text-orange-700";
    if (s === "doc_expirate") return "bg-red-100 text-red-700";
    return "bg-gray-100";
  };

  const filtered = vehicles.filter((v) => {
    const txt = `${v.brand} ${v.model} ${v.registration_number}`.toLowerCase();
    return txt.includes(search.toLowerCase());
  });

  const grouped = {
    camion: filtered.filter((v) => v.category === "camion"),
    autoutilitara: filtered.filter((v) => v.category === "autoutilitara"),
    microbuz: filtered.filter((v) => v.category === "microbuz"),
    masina_administrativa: filtered.filter(
      (v) => v.category === "masina_administrativa"
    ),
  };

  const toggle = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) return <div className="p-6">Se incarca...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Parc Auto</h1>
          <p className="text-sm text-gray-600">
            Gestioneaza vehiculele firmei, documentele si leasingul.
          </p>
        </div>

        {/* ADD BUTTON */}
        <button
          onClick={() => router.push("/admin/parc-auto/adauga")}
          className="mb-5 w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-base font-semibold text-white"
        >
          + Adauga auto
        </button>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="Cauta model sau nr..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-5 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
        />

        {/* SECTIONS */}
        <div className="space-y-4">
          {(Object.keys(grouped) as (keyof typeof grouped)[]).map((key) => {
            const list = grouped[key];

            return (
              <div key={key} className="rounded-2xl bg-white shadow">

                {/* HEADER */}
                <button
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {categoryLabels[key]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {list.length} vehicule
                    </p>
                  </div>

                  <div className="rounded-full bg-gray-100 px-3 py-1 text-lg">
                    {openSections[key] ? "-" : "+"}
                  </div>
                </button>

                {/* CONTENT */}
                {openSections[key] && (
                  <div className="border-t px-3 py-3 space-y-3">
                    {list.map((v) => {
                      const status = getStatus(v);
                      const warnings = getWarnings(v);

                      return (
                        <button
                          key={v.id}
                          onClick={() =>
                            router.push(`/admin/parc-auto/${v.id}`)
                          }
                          className="w-full rounded-xl border bg-gray-50 px-4 py-3 text-left"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-base font-semibold">
                                {v.brand} {v.model}
                              </p>
                              <p className="text-sm text-gray-500">
                                {v.registration_number}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span
                                  className={`px-3 py-1 text-xs rounded-full ${getStatusStyle(
                                    status
                                  )}`}
                                >
                                  {status}
                                </span>

                                {warnings.map((w) => (
                                  <span
                                    key={w}
                                    className="bg-yellow-100 text-yellow-800 px-3 py-1 text-xs rounded-full"
                                  >
                                    {w}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="text-2xl text-gray-400">›</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}