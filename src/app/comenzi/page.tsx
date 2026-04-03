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

export default function ComenziPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

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
        setOrders(ordersData as OrderRow[]);
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
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("toate")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                statusFilter === "toate"
                  ? "bg-[#0196ff] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Toate comenzile
            </button>

            <button
              onClick={() => setStatusFilter("asteapta_confirmare")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                statusFilter === "asteapta_confirmare"
                  ? "bg-[#0196ff] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Comenzi în așteptare
            </button>

            <button
              onClick={() => setStatusFilter("aprobata")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                statusFilter === "aprobata"
                  ? "bg-[#0196ff] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Comenzi aprobate
            </button>

            <button
              onClick={() => setStatusFilter("refuzata")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                statusFilter === "refuzata"
                  ? "bg-[#0196ff] text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Comenzi refuzate
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Caută după șantier"
              value={searchSantier}
              onChange={(e) => setSearchSantier(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-3"
            />

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
            <div className="col-span-1">Nr.</div>
            <div className="col-span-4 md:col-span-3">Șantier</div>
            <div className="col-span-3 md:col-span-2">Data</div>
            <div className="col-span-4 md:col-span-3">Valoare totală</div>
            <div className="hidden md:block md:col-span-3">Status</div>
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
                className="grid w-full grid-cols-12 border-b px-4 py-3 text-left text-sm transition hover:bg-gray-50 last:border-b-0"
              >
                <div className="col-span-1 font-semibold">{index + 1}</div>

                <div className="col-span-4 md:col-span-3">
                  {order.projects?.name || "-"}
                </div>

                <div className="col-span-3 md:col-span-2">
                  {new Date(order.order_date).toLocaleDateString("ro-RO")}
                </div>

                <div className="col-span-4 md:col-span-3 font-semibold">
                  {Number(order.total_with_vat || 0).toFixed(2)} lei
                </div>

                <div className="hidden md:block md:col-span-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
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