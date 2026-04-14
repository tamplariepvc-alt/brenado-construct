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

type FilterType =
  | "toate"
  | "active"
  | "in_reparatie"
  | "doc_expirate"
  | "urmeaza_sa_expire";

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

  const hasSearch = searchTerm.trim().length > 0;

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getDaysUntil = (value: string | null) => {
    const targetDate = parseDate(value);
    if (!targetDate) return null;

    const diffMs = targetDate.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getExpiryWarnings = (vehicle: Vehicle) => {
    const warnings: string[] = [];

    const rcaDays = getDaysUntil(vehicle.rca_valid_until);
    const itpDays = getDaysUntil(vehicle.itp_valid_until);

    if (rcaDays !== null && rcaDays >= 0 && rcaDays <= 30) {
      warnings.push(`Expira RCA in ${rcaDays} zile`);
    }

    if (itpDays !== null && itpDays >= 0 && itpDays <= 30) {
      warnings.push(`Expira ITP in ${itpDays} zile`);
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
      return "bg-yellow-100 text-yellow-800";
    }

    return "bg-gray-100 text-gray-700";
  };

  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(
      (vehicle) => getComputedStatus(vehicle) === "activa"
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

    return {
      total,
      active,
      inRepair,
      expiredDocs,
      expiringSoon,
    };
  }, [vehicles, today]);

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const computedStatus = getComputedStatus(vehicle);

      if (activeFilter === "active" && computedStatus !== "activa") {
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

  const getFilterLabel = () => {
    if (activeFilter === "toate") return "Toate";
    if (activeFilter === "active") return "Active";
    if (activeFilter === "in_reparatie") return "In reparatie";
    if (activeFilter === "doc_expirate") return "Doc. expirate";
    if (activeFilter === "urmeaza_sa_expire") return "Urmeaza sa expire";
    return "Toate";
  };

  const badgeButtonBase =
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition";

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

        <div className="mb-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter("toate")}
              className={`${badgeButtonBase} ${
                activeFilter === "toate"
                  ? "border-[#0196ff] bg-blue-50 text-[#0196ff]"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span>Total vehicule</span>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-[#0196ff] px-2 py-0.5 text-xs font-bold text-white">
                {stats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("active")}
              className={`${badgeButtonBase} ${
                activeFilter === "active"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span>Active</span>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                {stats.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("in_reparatie")}
              className={`${badgeButtonBase} ${
                activeFilter === "in_reparatie"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span>In reparatie</span>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                {stats.inRepair}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("doc_expirate")}
              className={`${badgeButtonBase} ${
                activeFilter === "doc_expirate"
                  ? "border-yellow-500 bg-yellow-50 text-yellow-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span>Doc. expirate</span>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
                {stats.expiredDocs}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("urmeaza_sa_expire")}
              className={`${badgeButtonBase} ${
                activeFilter === "urmeaza_sa_expire"
                  ? "border-gray-400 bg-gray-100 text-gray-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <span>Urmeaza sa expire</span>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-gray-500 px-2 py-0.5 text-xs font-bold text-white">
                {stats.expiringSoon}
              </span>
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Filtrare</h2>
              <p className="mt-1 text-sm text-gray-500">
                Tip filtru activ:{" "}
                <span className="font-semibold text-gray-800">{getFilterLabel()}</span>
              </p>
            </div>

            {(activeFilter !== "toate" || hasSearch) && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("toate");
                  setSearchTerm("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Reseteaza filtrele
              </button>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Cauta dupa model, nr de inmatriculare
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ex: Transit sau B123ABC"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>
        </div>

        {hasSearch ? (
          <div className="rounded-2xl bg-white p-4 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Rezultate cautare</h2>
              <p className="mt-1 text-sm text-gray-500">
                {filteredVehicles.length} vehicule gasite
              </p>
            </div>

            {filteredVehicles.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu exista vehicule care sa corespunda cautarii.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map((vehicle) => {
                  const computedStatus = getComputedStatus(vehicle);
                  const warnings = getExpiryWarnings(vehicle);

                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => router.push(`/admin/parc-auto/${vehicle.id}`)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:bg-gray-100"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 break-words">
                            {vehicle.brand} {vehicle.model}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 break-words">
                            Nr. inmatriculare: {vehicle.registration_number}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Categoria: {categoryLabels[vehicle.category as SectionKey]}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                          <span
                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              computedStatus
                            )}`}
                          >
                            {getStatusLabel(computedStatus)}
                          </span>

                          {warnings.map((warning) => (
                            <span
                              key={warning}
                              className="inline-flex w-fit rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                            >
                              {warning}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
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
                          Nu exista vehicule in aceasta categorie pentru filtrul curent.
                        </div>
                      ) : (
                        <div className="space-y-3 p-4">
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
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:bg-gray-100"
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

                                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                    <span
                                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                        computedStatus
                                      )}`}
                                    >
                                      {getStatusLabel(computedStatus)}
                                    </span>

                                    {warnings.map((warning) => (
                                      <span
                                        key={warning}
                                        className="inline-flex w-fit rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                                      >
                                        {warning}
                                      </span>
                                    ))}
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
        )}
      </div>
    </div>
  );
}