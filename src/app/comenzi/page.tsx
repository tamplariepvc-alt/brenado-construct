"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  project_id: string;
  order_date: string;
  status: string;
  total_with_vat: number;
  created_by: string;
  created_at: string;
  projects?: {
    name: string;
  } | null;
};

type OrderRowFromDb = {
  id: string;
  order_number: string | null;
  project_id: string;
  order_date: string;
  status: string;
  total_with_vat: number;
  created_by: string;
  created_at: string;
  projects?: {
    name: string;
  }[] | null;
};

type ProfileNameMap = Record<string, string>;

type StatusFilterKey =
  | "toate"
  | "asteapta_confirmare"
  | "aprobata"
  | "refuzata";

export default function ComenziPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profileNames, setProfileNames] = useState<ProfileNameMap>({});

  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("toate");
  const [searchSantier, setSearchSantier] = useState("");
  const [searchDate, setSearchDate] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        router.push("/login");
        return;
      }

      if (
        profileData.role !== "administrator" &&
        profileData.role !== "sef_echipa"
      ) {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData as Profile);

      // ── 1. Fetch comenzi ──────────────────────────────────────────────────────
      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          project_id,
          order_date,
          status,
          total_with_vat,
          created_by,
          created_at,
          projects:project_id (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (profileData.role === "sef_echipa") {
        query = query.eq("created_by", user.id);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError || !ordersData) {
        setLoading(false);
        return;
      }

      const typedOrdersFromDb = ordersData as OrderRowFromDb[];

      // ── 2. Normalizare join Supabase (array → object) ─────────────────────────
      let normalizedOrders: OrderRow[] = typedOrdersFromDb.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        project_id: order.project_id,
        order_date: order.order_date,
        status: order.status,
        total_with_vat: order.total_with_vat,
        created_by: order.created_by,
        created_at: order.created_at,
        projects: order.projects?.[0]
          ? { name: order.projects[0].name }
          : null,
      }));

      // ── 3. Fallback: fetch separat proiecte pentru comenzile fara nume ────────
      // Supabase poate returna null pe join daca RLS blocheaza tabela projects
      // sau daca project_id nu are corespondent. Facem un fetch separat ca siguranta.
      const missingProjectIds = Array.from(
        new Set(
          normalizedOrders
            .filter((o) => !o.projects?.name && o.project_id)
            .map((o) => o.project_id)
        )
      );

      if (missingProjectIds.length > 0) {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", missingProjectIds);

        if (projectsData && projectsData.length > 0) {
          const projectMap: Record<string, string> = {};
          projectsData.forEach((p: { id: string; name: string }) => {
            projectMap[p.id] = p.name;
          });

          normalizedOrders = normalizedOrders.map((order) => {
            if (!order.projects?.name && projectMap[order.project_id]) {
              return {
                ...order,
                projects: { name: projectMap[order.project_id] },
              };
            }
            return order;
          });
        }
      }

      setOrders(normalizedOrders);

      // ── 4. Fetch nume utilizatori (creat de) ──────────────────────────────────
      const userIds = Array.from(
        new Set(normalizedOrders.map((order) => order.created_by))
      );

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          const namesMap: ProfileNameMap = {};
          profilesData.forEach((profile) => {
            namesMap[profile.id] = profile.full_name;
          });
          setProfileNames(namesMap);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "toate" || order.status === statusFilter;

      const projectName = order.projects?.name || "";
      const matchesSantier = projectName
        .toLowerCase()
        .includes(searchSantier.toLowerCase());

      const matchesDate = !searchDate || order.order_date === searchDate;

      return matchesStatus && matchesSantier && matchesDate;
    });
  }, [orders, statusFilter, searchSantier, searchDate]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      inAsteptare: orders.filter(
        (order) => order.status === "asteapta_confirmare"
      ).length,
      aprobate: orders.filter((order) => order.status === "aprobata").length,
      refuzate: orders.filter((order) => order.status === "refuzata").length,
    };
  }, [orders]);

  const getStatusLabel = (status: string) => {
    if (status === "draft") return "Draft";
    if (status === "asteapta_confirmare") return "Așteaptă";
    if (status === "aprobata") return "Aprobată";
    if (status === "refuzata") return "Refuzată";
    return status;
  };

  const getStatusColor = (status: string) => {
    if (status === "asteapta_confirmare") return "bg-yellow-100 text-yellow-700";
    if (status === "aprobata") return "bg-green-100 text-green-700";
    if (status === "refuzata") return "bg-red-100 text-red-700";
    if (status === "draft") return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
  };

  const getFilterCardClasses = (filter: StatusFilterKey) => {
    const active = statusFilter === filter;

    if (filter === "toate") {
      return active
        ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
        : "border-transparent bg-blue-50";
    }
    if (filter === "asteapta_confirmare") {
      return active
        ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50"
        : "border-transparent bg-amber-50";
    }
    if (filter === "aprobata") {
      return active
        ? "border-green-400 ring-2 ring-green-200 bg-green-50"
        : "border-transparent bg-green-50";
    }
    return active
      ? "border-red-400 ring-2 ring-red-200 bg-red-50"
      : "border-transparent bg-red-50";
  };

  const renderOrderIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <path
        d="M4 6h2l1.4 6.5h8.8L18 8H8.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );

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
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          <div className="text-center">
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă comenzile...</p>
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la dashboard
            </button>

            <button
              onClick={() => router.push("/comenzi/adauga")}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Adaugă comandă
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderOrderIcon()}
            </div>

            <div>
              <p className="text-sm text-gray-500">
                {profile?.role === "administrator"
                  ? "Administrare comenzi"
                  : "Comenzile tale"}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Comenzi
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                {profile?.role === "administrator"
                  ? "Vezi toate comenzile din sistem."
                  : "Vezi comenzile create de tine."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter("toate")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses("toate")}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">
                {stats.total}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Toate
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("asteapta_confirmare")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses("asteapta_confirmare")}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-amber-600 sm:text-3xl">
                {stats.inAsteptare}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                În așteptare
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("aprobata")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses("aprobata")}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">
                {stats.aprobate}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">
                Aprobate
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("refuzata")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses("refuzata")}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-red-600 sm:text-3xl">
                {stats.refuzate}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">
                Refuzate
              </p>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Caută după șantier"
              value={searchSantier}
              onChange={(e) => setSearchSantier(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            />

            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista comenzi
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există comenzi pentru filtrele selectate.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-2">Nr.</div>
                  <div className="col-span-3">Șantier</div>
                  <div className="col-span-2">Data</div>
                  <div className="col-span-2">Valoare</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1"></div>
                </div>

                {filteredOrders.map((order, index) => (
                  <button
                    key={order.id}
                    onClick={() => router.push(`/comenzi/${order.id}`)}
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-2 text-sm font-semibold text-gray-900">
                      {order.order_number
                        ? order.order_number.replace("CMD-", "")
                        : String(index + 1).padStart(4, "0")}
                    </div>

                    <div className="col-span-3 text-sm text-gray-600">
                      {order.projects?.name || (
                        <span className="italic text-gray-400">Fără șantier</span>
                      )}
                    </div>

                    <div className="col-span-2 text-sm text-gray-500">
                      {new Date(order.order_date).toLocaleDateString("ro-RO")}
                    </div>

                    <div className="col-span-2 text-sm font-bold text-gray-900">
                      {Number(order.total_with_vat || 0).toFixed(2)} lei
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>

                    <div className="col-span-1 text-right text-2xl font-light text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {filteredOrders.map((order, index) => (
                  <button
                    key={order.id}
                    onClick={() => router.push(`/comenzi/${order.id}`)}
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderOrderIcon()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900">
                              {order.order_number
                                ? order.order_number.replace("CMD-", "")
                                : String(index + 1).padStart(4, "0")}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              {order.projects?.name || (
                                <span className="italic text-gray-400">Fără șantier</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 pr-10">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          Data
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          {new Date(order.order_date).toLocaleDateString("ro-RO")}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          Valoare
                        </p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {Number(order.total_with_vat || 0).toFixed(2)} lei
                        </p>
                      </div>
                    </div>

                    <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
