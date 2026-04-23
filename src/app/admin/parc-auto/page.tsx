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
  masina_administrativa: "Masini administrative",
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
      list.push(`Expira RCA in ${rca} zile`);
    }

    if (itp !== null && itp >= 0 && itp <= 30) {
      list.push(`Expira ITP in ${itp} zile`);
    }

    if (rovinieta !== null && rovinieta >= 0 && rovinieta <= 30) {
      list.push(`Expira Rovinieta in ${rovinieta} zile`);
    }

    if (casco !== null && casco >= 0 && casco <= 30) {
      list.push(`Expira Casco in ${casco} zile`);
    }

    return list;
  };

  const isExpiringSoon = (vehicle: Vehicle) =>
    getComputedStatus(vehicle) !== "doc_expirate" &&
    getWarnings(vehicle).length > 0;

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

  const showSections = filter === "toate";

  const renderVehicleIcon = (category: VehicleCategory) => {
    if (category === "camion") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600">
          <path
            d="M3 7h11v7H3V7Zm11 2h3l2 2v3h-5V9Zm-8 8a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (category === "microbuz") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600">
          <path
            d="M4 8.5c0-1.1.9-2 2-2h9.5c.6 0 1.1.2 1.5.6l2.4 2.4c.4.4.6.9.6 1.5V14H4V8.5Zm2 8a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600">
        <path
          d="M5 11l1.2-3.1c.3-.8 1.1-1.4 2-1.4h7.6c.9 0 1.7.6 2 1.4L19 11v4H5v-4Zm2 6a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const renderFilterCard = (
    type: FilterType,
    label: string,
    value: number,
    tone: string
  ) => {
    const active = filter === type;

    const toneClasses: Record<string, string> = {
      total: "bg-[#F4F2ED] text-gray-900",
      active: "bg-green-50 text-green-700",
      inactive: "bg-gray-100 text-gray-700",
      repair: "bg-orange-50 text-orange-700",
      expired: "bg-red-50 text-red-700",
      warning: "bg-yellow-50 text-yellow-700",
      leasing: "bg-purple-50 text-purple-700",
    };

    const activeRing: Record<string, string> = {
      total: "ring-2 ring-black",
      active: "ring-2 ring-green-600",
      inactive: "ring-2 ring-gray-500",
      repair: "ring-2 ring-orange-600",
      expired: "ring-2 ring-red-600",
      warning: "ring-2 ring-yellow-600",
      leasing: "ring-2 ring-purple-600",
    };

    return (
      <button
        type="button"
        onClick={() => setFilter(type)}
        className={`rounded-[24px] p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
          toneClasses[tone]
        } ${active ? activeRing[tone] : "border border-[#E8E5DE]"}`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-80 sm:text-[11px]">
          {label}
        </p>
        <p className="mt-3 text-3xl font-extrabold sm:text-4xl">{value}</p>
      </button>
    );
  };

  const renderVehicleCard = (v: Vehicle) => {
    const status = getComputedStatus(v);
    const warnings = getWarnings(v);

    return (
      <button
        key={v.id}
        onClick={() => router.push(`/admin/parc-auto/${v.id}`)}
        className="w-full rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                {renderVehicleIcon(v.category)}
              </div>

              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-lg">
                  {v.brand} {v.model}
                </p>
                <p className="mt-1 text-sm text-gray-500">{v.registration_number}</p>

                <div className="mt-3 flex flex-wrap gap-2">
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

                  {warnings.slice(0, 2).map((warning) => (
                    <span
                      key={warning}
                      className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                    >
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 text-2xl text-gray-400">›</div>
        </div>
      </button>
    );
  };

  if (loading) {
    return <div className="p-6">Se incarca parcul auto...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={150}
            height={48}
            className="h-11 w-auto object-contain"
          />

          <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin")}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la panou admin
            </button>

            <button
              onClick={() => router.push("/admin/parc-auto/adauga")}
              className="w-full rounded-xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              + Adaugă auto
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div>
            <p className="text-sm text-gray-500">Administrare flotă</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Parc Auto
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
              Gestionează vehiculele firmei, documentele și leasingul.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {renderFilterCard("toate", "Total", stats.total, "total")}
            {renderFilterCard("active", "Active", stats.active, "active")}
            {renderFilterCard("inactive", "Inactive", stats.inactive, "inactive")}
            {renderFilterCard("in_reparatie", "Reparație", stats.inRepair, "repair")}
            {renderFilterCard("doc_expirate", "Expirate", stats.expired, "expired")}
            {renderFilterCard(
              "urmeaza_sa_expire",
              "Urmează",
              stats.expiring,
              "warning"
            )}
            {renderFilterCard("leasing", "Leasing", stats.leasing, "leasing")}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <input
              type="text"
              className="w-full rounded-[22px] border border-gray-300 bg-white px-5 py-4 text-base outline-none transition focus:border-black"
              placeholder="Caută marcă, model sau nr. auto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          {categoryLabels[sectionKey]}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {list.length} vehicule
                        </p>
                      </div>

                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F2ED] text-xl font-semibold text-gray-700">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[#E8E5DE] px-4 py-4">
                        {list.length === 0 ? (
                          <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4 text-sm text-gray-500">
                            Nu există vehicule în această categorie.
                          </div>
                        ) : (
                          <div className="space-y-3">{list.map((v) => renderVehicleCard(v))}</div>
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