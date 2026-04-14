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
  monthly_rate: number | null;
  last_rate_date: string | null;
  status: VehicleStatus;
  created_at: string;
};

type SectionKey =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

const categoryLabels: Record<SectionKey, string> = {
  camion: "Camioane",
  autoutilitara: "Autoutilitare",
  microbuz: "Microbuze",
  masina_administrativa: "Masini Administrative",
};

export default function ParcAutoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    camion: false,
    autoutilitara: false,
    microbuz: false,
    masina_administrativa: false,
  });

  useEffect(() => {
    const loadVehicles = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id,
          category,
          brand,
          model,
          registration_number,
          rca_valid_until,
          itp_valid_until,
          is_leasing,
          monthly_rate,
          last_rate_date,
          status,
          created_at
        `)
        .order("category", { ascending: true })
        .order("brand", { ascending: true })
        .order("model", { ascending: true });

      if (!error && data) {
        setVehicles(data as Vehicle[]);
      } else {
        setVehicles([]);
      }

      setLoading(false);
    };

    loadVehicles();
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getComputedStatus = (vehicle: Vehicle) => {
    const rcaDate = parseDate(vehicle.rca_valid_until);
    const itpDate = parseDate(vehicle.itp_valid_until);

    const rcaExpired = rcaDate ? rcaDate.getTime() < today.getTime() : false;
    const itpExpired = itpDate ? itpDate.getTime() < today.getTime() : false;

    if (rcaExpired || itpExpired) {
      return "doc_expirate";
    }

    return vehicle.status;
  };

  const getStatusLabel = (status: string) => {
    if (status === "activa") return "Activa";
    if (status === "inactiva") return "Inactiva";
    if (status === "in_reparatie") return "In reparatie";
    if (status === "doc_expirate") return "Doc. expirate";
    return status;
  };

  const getStatusClasses = (status: string) => {
    if (status === "activa") {
      return "bg-green-100 text-green-700";
    }

    if (status === "inactiva") {
      return "bg-gray-100 text-gray-700";
    }

    if (status === "in_reparatie") {
      return "bg-orange-100 text-orange-700";
    }

    if (status === "doc_expirate") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  };

  const groupedVehicles = useMemo(() => {
    return {
      camion: vehicles.filter((vehicle) => vehicle.category === "camion"),
      autoutilitara: vehicles.filter(
        (vehicle) => vehicle.category === "autoutilitara"
      ),
      microbuz: vehicles.filter((vehicle) => vehicle.category === "microbuz"),
      masina_administrativa: vehicles.filter(
        (vehicle) => vehicle.category === "masina_administrativa"
      ),
    };
  }, [vehicles]);

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (loading) {
    return <div className="p-6">Se incarca parcul auto...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Parc Auto</h1>
            <p className="text-sm text-gray-600">
              Gestioneaza vehiculele firmei, documentele si leasingul.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Inapoi la panou admin
            </button>

            <button
              onClick={() => router.push("/admin/parc-auto/adauga")}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              + Adauga auto
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {(Object.keys(categoryLabels) as SectionKey[]).map((sectionKey) => {
            const sectionVehicles = groupedVehicles[sectionKey];
            const isOpen = openSections[sectionKey];

            return (
              <div
                key={sectionKey}
                className="overflow-hidden rounded-2xl bg-white shadow"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {categoryLabels[sectionKey]}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {sectionVehicles.length} vehicule
                    </p>
                  </div>

                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-700">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200">
                    {sectionVehicles.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-gray-500">
                        Nu exista vehicule in aceasta categorie.
                      </div>
                    ) : (
                      <div className="space-y-3 p-4">
                        {sectionVehicles.map((vehicle) => {
                          const computedStatus = getComputedStatus(vehicle);

                          return (
                            <div
                              key={vehicle.id}
                              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 break-words">
                                    {vehicle.brand} {vehicle.model}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-500 break-words">
                                    Nr. inmatriculare: {vehicle.registration_number}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                  <span
                                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                      computedStatus
                                    )}`}
                                  >
                                    {getStatusLabel(computedStatus)}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(`/admin/parc-auto/${vehicle.id}/edit`)
                                    }
                                    className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                                  >
                                    Actualizeaza
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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