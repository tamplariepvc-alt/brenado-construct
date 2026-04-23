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
    camion: false,
    autoutilitara: false,
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

  const showSections = filter === "toate" && search.trim() === "";

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
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-blue-600">
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          <div className="text-center">
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă datele...</p>
            <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[1fr_1.25fr] items-center gap-4">
            <div className="flex justify-center">
              <Image
                src="/logo.png"
                alt="Logo"
                width={210}
                height={70}
                className="h-16 w-auto object-contain sm:h-20"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/admin")}
                className="w-full rounded-[22px] border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:text-base"
              >
                Înapoi la dashboard
              </button>

              <button
                onClick={() => router.push("/admin/parc-auto/adauga")}
                className="w-full rounded-[22px] bg-[#0196ff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base"
              >
                + Adaugă
              </button>
            </div>
          </div>
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

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFilter("toate")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "toate"
                  ? "ring-2 ring-black bg-[#F8F7F3]"
                  : "bg-[#F8F7F3]"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Total
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{stats.total}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "active"
                  ? "ring-2 ring-green-600 bg-green-50"
                  : "bg-green-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-green-600">
                Active
              </p>
              <p className="mt-1.5 text-2xl font-bold text-green-700">{stats.active}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("inactive")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "inactive"
                  ? "ring-2 ring-gray-500 bg-gray-100"
                  : "bg-gray-100"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">
                Inactive
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-700">{stats.inactive}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("in_reparatie")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "in_reparatie"
                  ? "ring-2 ring-orange-600 bg-orange-50"
                  : "bg-orange-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-orange-600">
                Reparație
              </p>
              <p className="mt-1.5 text-2xl font-bold text-orange-700">{stats.inRepair}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("doc_expirate")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "doc_expirate"
                  ? "ring-2 ring-red-600 bg-red-50"
                  : "bg-red-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-red-600">
                Expirate
              </p>
              <p className="mt-1.5 text-2xl font-bold text-red-700">{stats.expired}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("urmeaza_sa_expire")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "urmeaza_sa_expire"
                  ? "ring-2 ring-yellow-600 bg-yellow-50"
                  : "bg-yellow-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-yellow-700">
                Urmează
              </p>
              <p className="mt-1.5 text-2xl font-bold text-yellow-800">{stats.expiring}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("leasing")}
              className={`rounded-2xl px-4 py-2.5 text-left transition ${
                filter === "leasing"
                  ? "ring-2 ring-purple-600 bg-purple-50"
                  : "bg-purple-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                Leasing
              </p>
              <p className="mt-1.5 text-2xl font-bold text-purple-700">{stats.leasing}</p>
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