"use client";

import Image from "next/image";
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

type FilterType =
  | "toate"
  | "active"
  | "inactive"
  | "in_reparatie"
  | "doc_expirate"
  | "urmeaza_sa_expire"
  | "leasing";

type SectionKey =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

const categoryLabels: Record<SectionKey, string> = {
  camion: "Camioane",
  autoutilitara: "Autoutilitare",
  microbuz: "Microbuze",
  masina_administrativa: "Mașini administrative",
};

const categoryIcons: Record<SectionKey, string> = {
  camion: "🚛",
  autoutilitara: "🚐",
  microbuz: "🚌",
  masina_administrativa: "🚗",
};

export default function ParcAutoPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("toate");

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    camion: true,
    autoutilitara: true,
    microbuz: false,
    masina_administrativa: false,
  });

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data } = await supabase
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

      setVehicles((data as Vehicle[]) || []);
      setLoading(false);
    };

    load();
  }, []);

  const parseDate = (value: string | null | undefined) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getDaysUntil = (value: string | null | undefined) => {
    const date = parseDate(value);
    if (!date) return null;
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  };

  const getComputedStatus = (vehicle: Vehicle) => {
    const rca = parseDate(vehicle.rca_valid_until);
    const itp = parseDate(vehicle.itp_valid_until);

    if ((rca && rca < today) || (itp && itp < today)) {
      return "doc_expirate";
    }

    return vehicle.status;
  };

  const getWarnings = (vehicle: Vehicle) => {
    const list: string[] = [];

    const rca = getDaysUntil(vehicle.rca_valid_until);
    const itp = getDaysUntil(vehicle.itp_valid_until);
    const rovinieta =
      vehicle.has_rovinieta && vehicle.rovinieta_valid_until
        ? getDaysUntil(vehicle.rovinieta_valid_until)
        : null;
    const casco =
      vehicle.has_casco && vehicle.casco_valid_until
        ? getDaysUntil(vehicle.casco_valid_until)
        : null;

    if (rca !== null && rca >= 0 && rca <= 30) {
      list.push(`Expiră RCA în ${rca} zile`);
    }

    if (itp !== null && itp >= 0 && itp <= 30) {
      list.push(`Expiră ITP în ${itp} zile`);
    }

    if (rovinieta !== null && rovinieta >= 0 && rovinieta <= 30) {
      list.push(`Expiră rovinieta în ${rovinieta} zile`);
    }

    if (casco !== null && casco >= 0 && casco <= 30) {
      list.push(`Expiră CASCO în ${casco} zile`);
    }

    return list;
  };

  const isExpiringSoon = (vehicle: Vehicle) =>
    getComputedStatus(vehicle) !== "doc_expirate" &&
    getWarnings(vehicle).length > 0;

  const getStatusLabel = (status: string) => {
    if (status === "activa") return "Activă";
    if (status === "inactiva") return "Inactivă";
    if (status === "in_reparatie") return "În reparație";
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
    return {
      total: vehicles.length,
      active: vehicles.filter((v) => getComputedStatus(v) === "activa").length,
      inactive: vehicles.filter((v) => getComputedStatus(v) === "inactiva").length,
      inRepair: vehicles.filter((v) => getComputedStatus(v) === "in_reparatie").length,
      expired: vehicles.filter((v) => getComputedStatus(v) === "doc_expirate").length,
      expiring: vehicles.filter((v) => isExpiringSoon(v)).length,
      leasing: vehicles.filter((v) => v.is_leasing).length,
    };
  }, [vehicles, today]);

  const filterCounts = {
    toate: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    in_reparatie: stats.inRepair,
    doc_expirate: stats.expired,
    urmeaza_sa_expire: stats.expiring,
    leasing: stats.leasing,
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const status = getComputedStatus(v);

      if (filter === "active" && status !== "activa") return false;
      if (filter === "inactive" && status !== "inactiva") return false;
      if (filter === "in_reparatie" && status !== "in_reparatie") return false;
      if (filter === "doc_expirate" && status !== "doc_expirate") return false;
      if (filter === "urmeaza_sa_expire" && !isExpiringSoon(v)) return false;
      if (filter === "leasing" && !v.is_leasing) return false;

      const txt = `${v.brand} ${v.model} ${v.registration_number}`.toLowerCase();
      return txt.includes(search.toLowerCase());
    });
  }, [vehicles, filter, search, today]);

  const grouped = useMemo(() => {
    return {
      camion: filteredVehicles.filter((v) => v.category === "camion"),
      autoutilitara: filteredVehicles.filter((v) => v.category === "autoutilitara"),
      microbuz: filteredVehicles.filter((v) => v.category === "microbuz"),
      masina_administrativa: filteredVehicles.filter(
        (v) => v.category === "masina_administrativa"
      ),
    };
  }, [filteredVehicles]);

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getFilterClasses = (type: FilterType) => {
    const isActive = filter === type;

    if (type === "toate") {
      return isActive
        ? "bg-[#0196ff] text-white"
        : "bg-gray-100 text-gray-900";
    }

    if (type === "active") {
      return isActive
        ? "bg-green-200 text-green-900"
        : "bg-green-100 text-green-800";
    }

    if (type === "inactive") {
      return isActive
        ? "bg-gray-300 text-gray-900"
        : "bg-gray-100 text-gray-800";
    }

    if (type === "in_reparatie") {
      return isActive
        ? "bg-orange-200 text-orange-900"
        : "bg-orange-100 text-orange-800";
    }

    if (type === "doc_expirate") {
      return isActive
        ? "bg-red-200 text-red-900"
        : "bg-red-100 text-red-800";
    }

    if (type === "urmeaza_sa_expire") {
      return isActive
        ? "bg-yellow-200 text-yellow-900"
        : "bg-yellow-100 text-yellow-800";
    }

    if (type === "leasing") {
      return isActive
        ? "bg-purple-200 text-purple-900"
        : "bg-purple-100 text-purple-800";
    }

    return "bg-gray-100 text-gray-800";
  };

  const getFilterBadgeClasses = (type: FilterType) => {
    if (type === "toate") {
      return filter === type ? "bg-white/20 text-white" : "bg-[#0196ff] text-white";
    }
    if (type === "active") return "bg-green-600 text-white";
    if (type === "inactive") return "bg-gray-500 text-white";
    if (type === "in_reparatie") return "bg-orange-500 text-white";
    if (type === "doc_expirate") return "bg-red-600 text-white";
    if (type === "urmeaza_sa_expire") return "bg-yellow-500 text-white";
    if (type === "leasing") return "bg-purple-600 text-white";
    return "bg-gray-500 text-white";
  };

  const showSections = filter === "toate";

  const renderVehicleCard = (v: Vehicle) => {
    const status = getComputedStatus(v);
    const warnings = getWarnings(v);

    return (
      <button
        key={v.id}
        onClick={() => router.push(`/admin/parc-auto/${v.id}`)}
        className="w-full rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-white text-2xl shadow-sm">
                {v.category === "camion" && "🚛"}
                {v.category === "autoutilitara" && "🚐"}
                {v.category === "microbuz" && "🚌"}
                {v.category === "masina_administrativa" && "🚗"}
              </div>

              <div className="min-w-0">
                <p className="break-words text-[15px] font-bold leading-5 text-gray-900 sm:text-lg">
                  {v.brand} {v.model}
                </p>
                <p className="mt-1 break-words text-sm text-gray-500">
                  {v.registration_number}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                  status
                )}`}
              >
                {getStatusLabel(status)}
              </span>

              {v.is_leasing && (
                <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Leasing
                </span>
              )}

              {warnings.map((warning) => (
                <span
                  key={warning}
                  className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                >
                  {warning}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                  RCA
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {v.rca_valid_until
                    ? new Date(v.rca_valid_until).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                  ITP
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {v.itp_valid_until
                    ? new Date(v.itp_valid_until).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-gray-400 shadow-sm">
            ›
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return <div className="p-6">Se încarcă parcul auto...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la panou admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Administrare flotă</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Parc Auto
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Gestionează vehiculele firmei, documentele și leasingul.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Total
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>

            <div className="rounded-2xl bg-green-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-green-600">
                Active
              </p>
              <p className="mt-2 text-2xl font-bold text-green-700">{stats.active}</p>
            </div>

            <div className="rounded-2xl bg-gray-100 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">
                Inactive
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-700">{stats.inactive}</p>
            </div>

            <div className="rounded-2xl bg-orange-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-orange-600">
                Reparație
              </p>
              <p className="mt-2 text-2xl font-bold text-orange-700">{stats.inRepair}</p>
            </div>

            <div className="rounded-2xl bg-red-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-red-600">
                Expirate
              </p>
              <p className="mt-2 text-2xl font-bold text-red-700">{stats.expired}</p>
            </div>

            <div className="rounded-2xl bg-yellow-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-yellow-700">
                Urmează
              </p>
              <p className="mt-2 text-2xl font-bold text-yellow-800">{stats.expiring}</p>
            </div>

            <div className="rounded-2xl bg-purple-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                Leasing
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-700">{stats.leasing}</p>
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={() => router.push("/admin/parc-auto/adauga")}
              className="w-full rounded-2xl bg-[#0196ff] px-4 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base"
            >
              + Adaugă auto
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFilter("toate")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "toate"
              )}`}
            >
              <span>Toate</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "toate"
                )}`}
              >
                {filterCounts.toate}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "active"
              )}`}
            >
              <span>Active</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "active"
                )}`}
              >
                {filterCounts.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("inactive")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "inactive"
              )}`}
            >
              <span>Inactive</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "inactive"
                )}`}
              >
                {filterCounts.inactive}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("in_reparatie")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "in_reparatie"
              )}`}
            >
              <span>În reparație</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "in_reparatie"
                )}`}
              >
                {filterCounts.in_reparatie}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("doc_expirate")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "doc_expirate"
              )}`}
            >
              <span>Doc expirate</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "doc_expirate"
                )}`}
              >
                {filterCounts.doc_expirate}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("urmeaza_sa_expire")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "urmeaza_sa_expire"
              )}`}
            >
              <span>Urmează să expire</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "urmeaza_sa_expire"
                )}`}
              >
                {filterCounts.urmeaza_sa_expire}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("leasing")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${getFilterClasses(
                "leasing"
              )}`}
            >
              <span>Leasing</span>
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${getFilterBadgeClasses(
                  "leasing"
                )}`}
              >
                {filterCounts.leasing}
              </span>
            </button>
          </div>

          <div className="mt-5">
            <input
              type="text"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black sm:px-5 sm:py-4 sm:text-base"
              placeholder="Caută după brand, model sau număr..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Vehicule
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {showSections ? (
            <div className="space-y-4">
              {(Object.keys(grouped) as SectionKey[]).map((sectionKey) => {
                const list = grouped[sectionKey];
                const isOpen = openSections[sectionKey];

                return (
                  <div
                    key={sectionKey}
                    className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-[#F8F7F3] text-xl">
                          {categoryIcons[sectionKey]}
                        </div>

                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                            {categoryLabels[sectionKey]}
                          </h2>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {list.length} vehicule
                          </p>
                        </div>
                      </div>

                      <span className="ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F8F7F3] text-xl font-medium text-gray-700">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[#E8E5DE] px-4 py-4">
                        {list.length === 0 ? (
                          <div className="rounded-2xl bg-[#FCFBF8] px-4 py-4 text-sm text-gray-500">
                            Nu există vehicule în această categorie pentru filtrul curent.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {list.map((v) => renderVehicleCard(v))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVehicles.length === 0 ? (
                <div className="rounded-[22px] border border-[#E8E5DE] bg-white px-4 py-5 text-sm text-gray-500 shadow-sm">
                  Nu există vehicule pentru filtrul selectat.
                </div>
              ) : (
                filteredVehicles.map((v) => renderVehicleCard(v))
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}