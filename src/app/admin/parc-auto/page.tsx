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
    camion: true,
    autoutilitara: true,
    microbuz: true,
    masina_administrativa: true,
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

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ro-RO");
  };

  const getMonthsRemaining = (lastRateDate: string | null) => {
    if (!lastRateDate) return 0;

    const lastDate = parseDate(lastRateDate);
    if (!lastDate) return 0;

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const lastYear = lastDate.getFullYear();
    const lastMonth = lastDate.getMonth();

    const diff = (lastYear - currentYear) * 12 + (lastMonth - currentMonth) + 1;

    return Math.max(0, diff);
  };

  const getRemainingLeasingValue = (vehicle: Vehicle) => {
    if (!vehicle.is_leasing) return 0;
    const monthlyRate = Number(vehicle.monthly_rate || 0);
    const monthsRemaining = getMonthsRemaining(vehicle.last_rate_date);
    return monthlyRate * monthsRemaining;
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
              <div key={sectionKey} className="overflow-hidden rounded-2xl bg-white shadow">
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

                  <span className="text-2xl text-gray-400">
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
                      <div className="divide-y divide-gray-200">
                        {sectionVehicles.map((vehicle) => {
                          const computedStatus = getComputedStatus(vehicle);
                          const leasingValue = getRemainingLeasingValue(vehicle);

                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              onClick={() =>
                                router.push(`/admin/parc-auto/${vehicle.id}/edit`)
                              }
                              className="grid w-full grid-cols-1 gap-4 px-5 py-4 text-left transition hover:bg-gray-50 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]"
                            >
                              <div>
                                <p className="text-base font-semibold text-gray-900">
                                  {vehicle.brand} {vehicle.model}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  Nr. inmatriculare: {vehicle.registration_number}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500">RCA</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {formatDate(vehicle.rca_valid_until)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500">ITP</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {formatDate(vehicle.itp_valid_until)}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500">Leasing</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {vehicle.is_leasing ? "Da" : "Nu"}
                                </p>
                                {vehicle.is_leasing && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Ramas: {leasingValue.toFixed(2)} lei
                                  </p>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500">Status</p>
                                <span
                                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                    computedStatus
                                  )}`}
                                >
                                  {getStatusLabel(computedStatus)}
                                </span>
                              </div>

                              <div className="self-center text-3xl font-light text-gray-400">
                                →
                              </div>
                            </button>
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