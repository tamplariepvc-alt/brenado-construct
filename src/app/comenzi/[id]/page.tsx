"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type OrderDetails = {
  id: string;
  order_number: string | null;
  project_id: string;
  created_by: string;
  order_date: string;
  status: string;
  subtotal: number;
  vat_total: number;
  total_with_vat: number;
  notes: string | null;
  created_at: string;
  creator_name?: string;
  projects?: {
    name: string;
  }[] | null;
};

type OrderItem = {
  id: string;
  article_number: string | null;
  article_code: string | null;
  article_name: string;
  unit: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  vat_percent: number;
  line_total_with_vat: number;
};

export default function ComandaDetaliuPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

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

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          project_id,
          created_by,
          order_date,
          status,
          subtotal,
          vat_total,
          total_with_vat,
          notes,
          created_at,
          projects:project_id (
            name
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        router.push("/comenzi");
        return;
      }
	  
	  const { data: creatorProfile } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("id", orderData.created_by)
  .single();
	  

      if (
        profileData.role === "sef_echipa" &&
        orderData.created_by !== user.id
      ) {
        router.push("/comenzi");
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          article_number,
          article_code,
          article_name,
          unit,
          unit_price,
          quantity,
          line_total,
          vat_percent,
          line_total_with_vat
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (!itemsError && itemsData) {
        setItems(itemsData as OrderItem[]);
      }

      setOrder({
  ...(orderData as OrderDetails),
  creator_name: creatorProfile?.full_name || "-",
});
      setLoading(false);
    };

    loadData();
  }, [orderId, router]);

  const statusLabel = useMemo(() => {
    if (!order) return "";
    if (order.status === "draft") return "Draft";
    if (order.status === "asteapta_confirmare") return "Așteaptă confirmare";
    if (order.status === "aprobata") return "Aprobată";
    if (order.status === "refuzata") return "Refuzată";
    return order.status;
  }, [order]);

  const statusClasses = useMemo(() => {
    if (!order) return "bg-gray-100 text-gray-700";
    if (order.status === "asteapta_confirmare") {
      return "bg-orange-100 text-orange-700";
    }
    if (order.status === "aprobata") {
      return "bg-green-100 text-green-700";
    }
    if (order.status === "refuzata") {
      return "bg-red-100 text-red-700";
    }
    if (order.status === "draft") {
      return "bg-gray-100 text-gray-700";
    }
    return "bg-gray-100 text-gray-700";
  }, [order]);

  const updateOrderStatus = async (newStatus: "aprobata" | "refuzata") => {
    if (!order) return;

    setActionLoading(true);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    if (error) {
      alert("A apărut o eroare la actualizarea statusului.");
      setActionLoading(false);
      return;
    }

    setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
    setActionLoading(false);
  };

  if (loading) {
    return <div className="p-6">Se încarcă detaliile comenzii...</div>;
  }

  if (!order) {
    return <div className="p-6">Comanda nu a fost găsită.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu comandă</h1>
            <p className="text-sm text-gray-600">
              Vezi informațiile complete ale comenzii.
            </p>
          </div>

          <button
            onClick={() => router.push("/comenzi")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la comenzi
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Informații comandă</h2>

              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
              >
                {statusLabel}
              </span>
            </div>

<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div>
    <p className="text-xs font-medium text-gray-500">Nr. comandă</p>
    <p className="mt-1 text-sm font-semibold">
      {order.order_number || "-"}
    </p>
  </div>

  <div>
    <p className="text-xs font-medium text-gray-500">Șantier</p>
    <p className="mt-1 text-sm font-semibold">
      {order.projects?.[0]?.name || "-"}
    </p>
  </div>

  <div>
    <p className="text-xs font-medium text-gray-500">Data comenzii</p>
    <p className="mt-1 text-sm font-semibold">
      {new Date(order.order_date).toLocaleDateString("ro-RO")}
    </p>
  </div>

  <div>
    <p className="text-xs font-medium text-gray-500">Creată de</p>
    <p className="mt-1 text-sm font-semibold">
      {order.creator_name || "-"}
    </p>
  </div>
</div>

            {order.notes && (
              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">Observații</p>
                <p className="mt-1 text-sm text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-3 text-base font-semibold">Articole comandă</h2>

{items.length === 0 ? (
  <p className="text-sm text-gray-500">
    Nu există articole în această comandă.
  </p>
) : (
<div>
    {items.map((item, index) => (
      <div
        key={item.id}
className="bg-gray-50 px-4 py-4 border-b border-gray-200 last:border-b-0"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Nr.</p>
            <p className="text-sm font-semibold">{index + 1}</p>
          </div>

          <div className="flex-1">
            <p className="text-xs text-gray-500">Cod</p>
            <p className="text-sm font-medium break-words">
              {item.article_code || "-"}
            </p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-500">Denumire</p>
          <p className="text-sm font-medium break-words leading-5">
            {item.article_name}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500">Cantitate</p>
            <p className="text-sm font-medium">
              {Number(item.quantity).toFixed(0)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">P. Unitar</p>
            <p className="text-sm font-medium">
              {Number(item.unit_price).toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">V. Totală</p>
            <p className="text-sm font-semibold">
              {Number(item.line_total_with_vat).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
)}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-3 text-base font-semibold">Totaluri</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="mt-1 text-lg font-semibold">
                  {Number(order.subtotal).toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">TVA</p>
                <p className="mt-1 text-lg font-semibold">
                  {Number(order.vat_total).toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-xl bg-[#0196ff] p-4 text-white">
                <p className="text-sm opacity-90">Total cu TVA</p>
                <p className="mt-1 text-lg font-semibold">
                  {Number(order.total_with_vat).toFixed(2)} lei
                </p>
              </div>
            </div>
          </div>

          {profile?.role === "administrator" &&
            order.status === "asteapta_confirmare" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => updateOrderStatus("refuzata")}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {actionLoading ? "Se procesează..." : "Refuză comanda"}
                </button>

                <button
                  type="button"
                  onClick={() => updateOrderStatus("aprobata")}
                  disabled={actionLoading}
                  className="rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {actionLoading ? "Se procesează..." : "Confirmă comanda"}
                </button>
              </div>
            )}

          {order.status === "draft" &&
            (profile?.role === "administrator" ||
              profile?.role === "sef_echipa") && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push(`/comenzi/${order.id}/editare`)}
                  className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white"
                >
                  Editează comanda
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}