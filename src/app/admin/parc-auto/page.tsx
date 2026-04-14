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
  rovinieta_valid_until?: string | null;
  casco_valid_until?: string | null;
  has_rovinieta?: boolean | null;
  has_casco?: boolean | null;
  is_leasing: boolean;
  status: VehicleStatus;
  created_at: string;
};

type SectionKey =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

type FilterType =
  | "toate"
  | "active"
  | "inactive"
  | "in_reparatie"
  | "doc_expirate"
  | "urmeaza_sa_expire"
  | "leasing";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("toate");
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
          rovinieta_valid_until,
          casco_valid_until,
          has_rovinieta,
          has_casco,
          is_leasing,
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

  const parseDate = (value: string | null | undefined) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getDaysUntil = (value: string | null | undefined) => {
    const targetDate = parseDate(value);
    if (!targetDate) return null;

    const diffMs = targetDate.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getExpiryWarnings = (vehicle: Vehicle) => {
    const warnings: string[] = [];

    const rcaDays = getDaysUntil(vehicle.rca_valid_until);
    const itpDays = getDaysUntil(vehicle.itp_valid_until);
    const rovinietaDays =
      vehicle.has_rovinieta ? getDaysUntil(vehicle.rovinieta_valid_until) : null;
    const cascoDays =
      vehicle.has_casco ? getDaysUntil(vehicle.casco_valid_until) : null;

    if (rcaDays !== null && rcaDays >= 0 && rcaDays <= 30) {
      warnings.push(`Expira RCA in ${rcaDays} zile`);
    }

    if (itpDays !== null && itpDays >= 0 && itpDays <= 30) {
      warnings.push(`Expira ITP in ${itpDays} zile`);
    }

    if (rovinietaDays !== null && rovinietaDays >= 0 && rovinietaDays <= 30) {
      warnings.push(`Expira Rovinieta in ${rovinietaDays} zile`);
    }

    if (cascoDays !== null && cascoDays >= 0 && cascoDays <= 30) {
      warnings.push(`Expira Casco in ${cascoDays} zile`);
    }

    return warnings;
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

  const isExpiringSoon = (vehicle: Vehicle) => {
    if (getComputedStatus(vehicle) === "doc_expirate") return false;
    return getExpiryWarnings(vehicle).length > 0;
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
    if (status === "inactiva") return "bg-gray-100 text-gray-700";
    if (status === "in_reparatie") return "bg-orange-100 text-orange-700";
    if (status === "doc_expirate") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(
      (vehicle) => getComputedStatus(vehicle) === "activa"
    ).length;
    const inactive = vehicles.filter(
      (vehicle) => getComputedStatus(vehicle) === "inactiva"
    ).length;
    const inRepair = vehicles.filter(
      (vehicle) => getComputedStatus(vehicle) === "in_reparatie"
    ).length;
    const expiredDocs = vehicles.filter(
      (vehicle) => getComputedStatus(vehicle) === "doc_expirate"
    ).length;
    const expiringSoon = vehicles.filter((vehicle) =>
      isExpiringSoon(vehicle)
    ).length;
    const leasing = vehicles.filter((vehicle) => vehicle.is_leasing).length;

    return {
      total,
      active,
      inactive,
      inRepair,
      expiredDocs,
      expiringSoon,
      leasing,
    };
  }, [vehicles, today]);

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const computedStatus = getComputedStatus(vehicle);

      if (activeFilter === "active" && computedStatus !== "activa") {
        return false;
      }

      if (activeFilter === "inactive" && computedStatus !== "inactiva") {
        return false;
      }

      if (activeFilter === "in_reparatie" && computedStatus !== "in_reparatie") {
        return false;
      }

      if (activeFilter === "doc_expirate" && computedStatus !== "doc_expirate") {
        return false;
      }

      if (activeFilter === "urmeaza_sa_expire" && !isExpiringSoon(vehicle)) {
        return false;
      }

      if (activeFilter === "leasing" && !vehicle.is_leasing) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const brandModel = `${vehicle.brand} ${vehicle.model}`.toLowerCase();
      const registration = vehicle.registration_number.toLowerCase();

      return (
        brandModel.includes(normalizedSearch) ||
        registration.includes(normalizedSearch)
      );
    });
  }, [vehicles, activeFilter, searchTerm, today]);

  const groupedVehicles = useMemo(() => {
    return {
      camion: filteredVehicles.filter((vehicle) => vehicle.category === "camion"),
      autoutilitara: filteredVehicles.filter(
        (vehicle) => vehicle.category === "autoutilitara"
      ),
      microbuz: filteredVehicles.filter((vehicle) => vehicle.category === "microbuz"),
      masina_administrativa: filteredVehicles.filter(
        (vehicle) => vehicle.category === "masina_administrativa"
      ),
    };
  }, [filteredVehicles]);

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const filterButtonClasses = (filter: FilterType) => {
    const isActive = activeFilter === filter;

    if (filter === "toate") {
      return isActive
        ? "bg-gray-900 text-white"
        : "bg-transparent text-gray-900";
    }

    if (filter === "active") {
      return isActive
        ? "bg-green-200 text-green-900"
        : "bg-green-100 text-green-800";
    }

    if (filter === "inactive") {
      return isActive
        ? "bg-gray-300 text-gray-900"
        : "bg-gray-200 text-gray-800";
    }

    if (filter === "in_reparatie") {
      return isActive
        ? "bg-orange-200 text-orange-900"
        : "bg-orange-100 text-orange-800";
    }

    if (filter === "doc_expirate") {
      return isActive
        ? "bg-red-200 text-red-900"
        : "bg-red-100 text-red-800";
    }

    if (filter === "urmeaza_sa_expire") {
      return isActive
        ? "bg-yellow-200 text-yellow-900"
        : "bg-yellow-100 text-yellow-800";
    }

    if (filter === "leasing") {
      return isActive
        ? "bg-purple-200 text-purple-900"
        : "bg-purple-100 text-purple-800";
    }

    return "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="p-6">Se incarca parcul auto...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Parc Auto</h1>
        </div>

        <button
          onClick={() => router.push("/admin/parc-auto/adauga")}
          className="mb-6 w-full rounded-2xl bg-[#0196ff] px-4 py-4 text-lg font-semibold text-white shadow"
        >
          + Adauga auto
        </button>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveFilter("toate")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "toate"
            )}`}
          >
            Toate
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("active")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "active"
            )}`}
          >
            Active
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("inactive")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "inactive"
            )}`}
          >
            Inactive
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("in_reparatie")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "in_reparatie"
            )}`}
          >
            In reparatie
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("doc_expirate")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "doc_expirate"
            )}`}
          >
            Doc expirate
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("urmeaza_sa_expire")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "urmeaza_sa_expire"
            )}`}
          >
            Urmeaza sa expire
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("leasing")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filterButtonClasses(
              "leasing"
            )}`}
          >
            Leasing
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cauta model sau nr..."
            className="w-full rounded-2xl border-2 border-gray-900 bg-white px-6 py-5 text-lg outline-none"
          />
        </div>

        <div className="space-y-5">
          {(Object.keys(categoryLabels) as SectionKey[]).map((sectionKey) => {
            const sectionVehicles = groupedVehicles[sectionKey];
            const isOpen = openSections[sectionKey];

            return (
              <div
                key={sectionKey}
                className="overflow-hidden rounded-3xl bg-white shadow"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="flex w-full items-center justify-between px-6 py-6 text-left"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {categoryLabels[sectionKey]}
                    </h2>
                    <p className="mt-2 text-lg text-gray-500">
                      {sectionVehicles.length} vehicule
                    </p>
                  </div>

                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-4xl font-medium text-gray-600">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200 px-4 py-4">
                    {sectionVehicles.length === 0 ? (
                      <div className="px-3 py-5 text-lg text-gray-500">
                        Nu exista vehicule in aceasta categorie pentru filtrul curent.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sectionVehicles.map((vehicle) => {
                          const computedStatus = getComputedStatus(vehicle);
                          const warnings = getExpiryWarnings(vehicle);

                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              onClick={() =>
                                router.push(`/admin/parc-auto/${vehicle.id}`)
                              }
                              className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-5 py-5 text-left shadow-sm transition hover:bg-gray-100"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="text-2xl font-bold text-gray-900 break-words">
                                    {vehicle.brand} {vehicle.model}
                                  </p>

                                  <p className="mt-1 text-2xl text-gray-500 break-words">
                                    {vehicle.registration_number}
                                  </p>

                                  <div className="mt-4 flex flex-wrap gap-3">
                                    <span
                                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(
                                        computedStatus
                                      )}`}
                                    >
                                      {getStatusLabel(computedStatus)}
                                    </span>

                                    {vehicle.is_leasing && (
                                      <span className="inline-flex rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
                                        Leasing
                                      </span>
                                    )}

                                    {warnings.map((warning) => (
                                      <span
                                        key={warning}
                                        className="inline-flex rounded-full bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800"
                                      >
                                        {warning}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="shrink-0 text-5xl font-light text-gray-400">
                                  ›
                                </div>
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