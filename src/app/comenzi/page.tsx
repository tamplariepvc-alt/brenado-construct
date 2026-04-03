"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
  }[] | null;
};

type ProfileNameMap = Record<string, string>;

export default function ComenziPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profileNames, setProfileNames] = useState<ProfileNameMap>({});

  const [statusFilter, setStatusFilter] = useState("toate");
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

if (!ordersError && ordersData) {
  const typedOrders = ordersData as OrderRow[];
  setOrders(typedOrders);

  const userIds = Array.from(
    new Set(typedOrders.map((order) => order.created_by))
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
}

      setLoading(false);
    };

    loadData();
  }, [router]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "toate" || order.status === statusFilter;

      const projectName = order.projects?.[0]?.name || "";
      const matchesSantier = projectName
        .toLowerCase()
        .includes(searchSantier.toLowerCase());

      const matchesDate =
        !searchDate || order.order_date === searchDate;

      return matchesStatus && matchesSantier && matchesDate;
    });
  }, [orders, statusFilter, searchSantier, searchDate]);

  const getStatusLabel = (status: string) => {
    if (status === "draft") return "Draft";
    if (status === "asteapta_confirmare") return "Așteaptă confirmare";
    if (status === "aprobata") return "Aprobată";
    if (status === "refuzata") return "Refuzată";
    return status;
  };

  const getStatusColor = (status: string) => {
    if (status === "asteapta_confirmare") return "bg-orange-100 text-orange-700";
    if (status === "aprobata") return "bg-green-100 text-green-700";
    if (status === "refuzata") return "bg-red-100 text-red-700";
    if (status === "draft") return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="p-6">Se încarcă comenzile...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comenzi</h1>
            <p className="text-sm text-gray-600">
              {profile?.role === "administrator"
                ? "Vezi toate comenzile din sistem"
                : "Vezi comenzile create de tine"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Înapoi la dashboard
            </button>

            <button
              onClick={() => router.push("/comenzi/adauga")}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              + Adaugă comandă
            </button>
          </div>
        </div>

        {/* FILTRE */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow">
<div className="mb-4 grid grid-cols-1 gap-3">
 <button
  onClick={() => setStatusFilter("toate")}
  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
    statusFilter === "toate"
      ? "text-white"
      : "bg-gray-100 text-gray-700"
  }`}
  style={{
    backgroundColor: statusFilter === "toate" ? "#0196ff" : undefined,
  }}
>
  Toate comenzile
</button>

<button
  onClick={() => setStatusFilter("asteapta_confirmare")}
  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
    statusFilter === "asteapta_confirmare"
      ? "text-white"
      : "bg-gray-100 text-gray-700"
  }`}
  style={{
    backgroundColor:
      statusFilter === "asteapta_confirmare" ? "#f59e0b" : undefined,
  }}
>
  Comenzi în așteptare
</button>

<button
  onClick={() => setStatusFilter("aprobata")}
  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
    statusFilter === "aprobata"
      ? "text-white"
      : "bg-gray-100 text-gray-700"
  }`}
  style={{
    backgroundColor:
      statusFilter === "aprobata" ? "#16a34a" : undefined,
  }}
>
  Comenzi aprobate
</button>

<button
  onClick={() => setStatusFilter("refuzata")}
  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold ${
    statusFilter === "refuzata"
      ? "text-white"
      : "bg-gray-100 text-gray-700"
  }`}
  style={{
    backgroundColor:
      statusFilter === "refuzata" ? "#dc2626" : undefined,
  }}
>
  Comenzi refuzate
</button>
          </div>

<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-gray-700">
    Caută după șantier
  </label>
  <input
    type="text"
    placeholder="Introdu numele șantierului"
    value={searchSantier}
    onChange={(e) => setSearchSantier(e.target.value)}
    className="rounded-lg border border-gray-300 px-4 py-3"
  />
</div>
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-gray-700">
    Caută după data
  </label>
  <input
    type="date"
    value={searchDate}
    onChange={(e) => setSearchDate(e.target.value)}
    className="rounded-lg border border-gray-300 px-4 py-3"
  />
</div>
        </div>

        {/* LISTA COMENZI */}
        <div className="overflow-hidden rounded-2xl bg-white shadow">
<div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
  <div className="col-span-2 md:col-span-2">Nr. comandă</div>
  <div className="col-span-3 md:col-span-3">Șantier</div>
  <div className="col-span-2 md:col-span-2">Data</div>
  <div className="hidden md:block md:col-span-2">Creat de</div>
  <div className="col-span-2 md:col-span-1">Valoare</div>
  <div className="hidden md:block md:col-span-2">Status</div>
</div>

          {filteredOrders.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Nu există comenzi pentru filtrele selectate.
            </div>
          ) : (
            filteredOrders.map((order, index) => (
<button
  key={order.id}
  onClick={() => router.push(`/comenzi/${order.id}`)}
  className="grid w-full grid-cols-5 items-start border-b px-4 py-4 text-left text-sm transition hover:bg-gray-50 last:border-b-0"
>
  <div className="font-semibold break-words">
    {order.order_number || `CMD-${String(index + 1).padStart(4, "0")}`}
  </div>

  <div className="break-words">
    {order.projects?.[0]?.name || "-"}
  </div>

  <div>
    {new Date(order.order_date).toLocaleDateString("ro-RO")}
  </div>

  <div className="font-semibold break-words">
    {Number(order.total_with_vat || 0).toFixed(2)} lei
  </div>

  <div>
    <span
      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
        order.status
      )}`}
    >
      {getStatusLabel(order.status)}
    </span>
  </div>
</button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}