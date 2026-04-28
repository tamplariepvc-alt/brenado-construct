"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

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
          id, category, brand, model, registration_number,
          rca_valid_until, itp_valid_until,
          rovinieta_valid_until, casco_valid_until,
          has_rovinieta, has_casco,
          is_leasing, status, created_at
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
    if ((rca && rca < today) || (itp && itp < today)) return "doc_expirate";
    return vehicle.status;
  };

  const getWarnings = (vehicle: Vehicle) => {
    const list: string[] = [];
    const rca = getDaysUntil(vehicle.rca_valid_until);
    const itp = getDaysUntil(vehicle.itp_valid_until);
    const rovinieta = vehicle.has_rovinieta && vehicle.rovinieta_valid_until
      ? getDaysUntil(vehicle.rovinieta_valid_until) : null;
    const casco = vehicle.has_casco && vehicle.casco_valid_until
      ? getDaysUntil(vehicle.casco_valid_until) : null;

    if (rca !== null && rca >= 0 && rca <= 30) list.push(`RCA expiră în ${rca} zile`);
    if (itp !== null && itp >= 0 && itp <= 30) list.push(`ITP expiră în ${itp} zile`);
    if (rovinieta !== null && rovinieta >= 0 && rovinieta <= 30) list.push(`Rovinieta expiră în ${rovinieta} zile`);
    if (casco !== null && casco >= 0 && casco <= 30) list.push(`CASCO expiră în ${casco} zile`);
    return list;
  };

  const isExpiringSoon = (vehicle: Vehicle) =>
    getComputedStatus(vehicle) !== "doc_expirate" && getWarnings(vehicle).length > 0;

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

  const stats = useMemo(() => ({
    total: vehicles.length,
    active: vehicles.filter((v) => getComputedStatus(v) === "activa").length,
    inactive: vehicles.filter((v) => getComputedStatus(v) === "inactiva").length,
    inRepair: vehicles.filter((v) => getComputedStatus(v) === "in_reparatie").length,
    expired: vehicles.filter((v) => getComputedStatus(v) === "doc_expirate").length,
    expiring: vehicles.filter((v) => isExpiringSoon(v)).length,
    leasing: vehicles.filter((v) => v.is_leasing).length,
  }), [vehicles, today]);

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

  const grouped = useMemo(() => ({
    camion: filteredVehicles.filter((v) => v.category === "camion"),
    autoutilitara: filteredVehicles.filter((v) => v.category === "autoutilitara"),
    microbuz: filteredVehicles.filter((v) => v.category === "microbuz"),
    masina_administrativa: filteredVehicles.filter((v) => v.category === "masina_administrativa"),
  }), [filteredVehicles]);

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const showSections = filter === "toate" && search.trim() === "";

  // filtre config
  const filterCards = [
    { key: "toate" as FilterType, label: "Total", value: stats.total, color: "bg-[#F8F7F3]", textColor: "text-gray-900", labelColor: "text-gray-400", ring: "ring-gray-400" },
    { key: "active" as FilterType, label: "Active", value: stats.active, color: "bg-green-50", textColor: "text-green-700", labelColor: "text-green-500", ring: "ring-green-500" },
    { key: "inactive" as FilterType, label: "Inactive", value: stats.inactive, color: "bg-gray-100", textColor: "text-gray-700", labelColor: "text-gray-400", ring: "ring-gray-400" },
    { key: "in_reparatie" as FilterType, label: "Reparație", value: stats.inRepair, color: "bg-orange-50", textColor: "text-orange-700", labelColor: "text-orange-500", ring: "ring-orange-500" },
    { key: "doc_expirate" as FilterType, label: "Expirate", value: stats.expired, color: "bg-red-50", textColor: "text-red-700", labelColor: "text-red-500", ring: "ring-red-500" },
    { key: "urmeaza_sa_expire" as FilterType, label: "Urmează", value: stats.expiring, color: "bg-yellow-50", textColor: "text-yellow-800", labelColor: "text-yellow-600", ring: "ring-yellow-500" },
    { key: "leasing" as FilterType, label: "Leasing", value: stats.leasing, color: "bg-purple-50", textColor: "text-purple-700", labelColor: "text-purple-500", ring: "ring-purple-500" },
  ];

  const renderVehicleCard = (v: Vehicle) => {
    const status = getComputedStatus(v);
    const warnings = getWarnings(v);

    return (
      <button
        key={v.id}
        onClick={() => router.push(`/admin/parc-auto/${v.id}`)}
        className="relative w-full rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-[#F8F7F3] text-2xl">
              {v.category === "camion" && "🚛"}
              {v.category === "autoutilitara" && "🚐"}
              {v.category === "microbuz" && "🚌"}
              {v.category === "masina_administrativa" && "🚗"}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-base">
                {v.brand} {v.model}
              </p>
              <p className="mt-0.5 text-sm font-medium text-gray-500">
                {v.registration_number}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}>
              {getStatusLabel(status)}
            </span>
            {v.is_leasing && (
              <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                Leasing
              </span>
            )}
          </div>
        </div>

        {/* Documente */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#F8F7F3] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">RCA</p>
            <p className="mt-0.5 text-sm font-medium text-gray-700">
              {v.rca_valid_until
                ? new Date(v.rca_valid_until).toLocaleDateString("ro-RO")
                : "-"}
            </p>
          </div>
          <div className="rounded-xl bg-[#F8F7F3] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">ITP</p>
            <p className="mt-0.5 text-sm font-medium text-gray-700">
              {v.itp_valid_until
                ? new Date(v.itp_valid_until).toLocaleDateString("ro-RO")
                : "-"}
            </p>
          </div>
        </div>

        {/* Avertismente */}
        {warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {warnings.map((warning) => (
              <span
                key={warning}
                className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800"
              >
                ⚠ {warning}
              </span>
            ))}
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400">
          ›
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-blue-600">
                <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M5 16v2M19 16v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="8" cy="17" r="1.5" fill="currentColor" />
                <circle cx="16" cy="17" r="1.5" fill="currentColor" />
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
      {/* Header — standard ca restul aplicatiei */}
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
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-4"
            >
              Înapoi
            </button>
            <button
              onClick={() => router.push("/admin/parc-auto/adauga")}
              className="rounded-xl bg-[#0196ff] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-4"
            >
              + Adaugă
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-amber-50 sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-amber-600 sm:h-7 sm:w-7">
                <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M5 16v2M19 16v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="8" cy="17" r="1.5" fill="currentColor" />
                <circle cx="16" cy="17" r="1.5" fill="currentColor" />
              </svg>
            </div>
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

          {/* Filtre — grid 4 col pe mobil, 7 pe desktop */}
          <div className="mt-5 grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
            {filterCards.map((fc) => (
              <button
                key={fc.key}
                type="button"
                onClick={() => setFilter(fc.key)}
                className={`rounded-xl px-2 py-2 text-left transition sm:rounded-2xl sm:px-3 sm:py-2.5 ${fc.color} ${
                  filter === fc.key ? `ring-2 ${fc.ring}` : ""
                }`}
              >
                <p className={`text-[9px] font-semibold uppercase tracking-wide sm:text-[10px] sm:tracking-[0.12em] ${fc.labelColor}`}>
                  {fc.label}
                </p>
                <p className={`mt-1 text-lg font-extrabold sm:text-2xl ${fc.textColor}`}>
                  {fc.value}
                </p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              placeholder="Caută după brand, model sau număr înmatriculare..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        {/* Lista vehicule */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Vehicule — {filteredVehicles.length} rezultate
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
                      className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-[#F8F7F3] text-xl">
                          {categoryIcons[sectionKey]}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-gray-900 sm:text-lg">
                            {categoryLabels[sectionKey]}
                          </h2>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {list.length} vehicule
                          </p>
                        </div>
                      </div>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-medium transition ${
                        isOpen ? "bg-gray-900 text-white" : "bg-[#F8F7F3] text-gray-700"
                      }`}>
                        {isOpen ? "−" : "+"}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[#E8E5DE] px-4 py-4">
                        {list.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            Nu există vehicule în această categorie.
                          </p>
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
                <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                  <p className="text-sm text-gray-500">
                    Nu există vehicule pentru filtrul selectat.
                  </p>
                </div>
              ) : (
                filteredVehicles.map((v) => renderVehicleCard(v))
              )}
            </div>
          )}
        </section>
      </main>
 <BottomNav />
    </div>
  );
}
