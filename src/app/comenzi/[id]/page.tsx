"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { exportOrderPdf } from "@/lib/pdf/export-order-pdf";

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
  } | null;
};

type OrderDetailsFromDb = {
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

      // ── 1. Fetch comanda cu join pe projects ──────────────────────────────────
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

      const typedOrderData = orderData as OrderDetailsFromDb;

      // ── 2. Verificare acces sef_echipa ────────────────────────────────────────
      if (
        profileData.role === "sef_echipa" &&
        typedOrderData.created_by !== user.id
      ) {
        router.push("/comenzi");
        return;
      }

      // ── 3. Normalizare join (array → object) ──────────────────────────────────
      let projectName: string | null =
        typedOrderData.projects?.[0]?.name || null;

      // ── 4. Fallback: fetch separat daca join-ul a returnat null ───────────────
      // Se intampla cand RLS blocheaza SELECT pe tabela projects pentru join-uri
      if (!projectName && typedOrderData.project_id) {
        const { data: projectData } = await supabase
          .from("projects")
          .select("name")
          .eq("id", typedOrderData.project_id)
          .single();

        if (projectData?.name) {
          projectName = projectData.name;
        }
      }

      // ── 5. Fetch creator name ─────────────────────────────────────────────────
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", typedOrderData.created_by)
        .single();

      // ── 6. Fetch articole ─────────────────────────────────────────────────────
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
        id: typedOrderData.id,
        order_number: typedOrderData.order_number,
        project_id: typedOrderData.project_id,
        created_by: typedOrderData.created_by,
        order_date: typedOrderData.order_date,
        status: typedOrderData.status,
        subtotal: typedOrderData.subtotal,
        vat_total: typedOrderData.vat_total,
        total_with_vat: typedOrderData.total_with_vat,
        notes: typedOrderData.notes,
        created_at: typedOrderData.created_at,
        creator_name: creatorProfile?.full_name || "-",
        projects: projectName ? { name: projectName } : null,
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
    if (order.status === "asteapta_confirmare") return "bg-orange-100 text-orange-700";
    if (order.status === "aprobata") return "bg-green-100 text-green-700";
    if (order.status === "refuzata") return "bg-red-100 text-red-700";
    if (order.status === "draft") return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
  }, [order]);

  const handleExportPdf = async () => {
    if (!order) return;

    await exportOrderPdf({
      orderNumber: order.order_number || "-",
      projectName: order.projects?.name || "-",
      orderDate: new Date(order.order_date).toLocaleDateString("ro-RO"),
      creatorName: order.creator_name || "-",
      status: order.status,
      subtotal: Number(order.subtotal || 0),
      vatTotal: Number(order.vat_total || 0),
      totalWithVat: Number(order.total_with_vat || 0),
      items: items.map((item) => ({
        article_code: item.article_code,
        article_name: item.article_name,
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
      })),
    });
  };

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
    return <div className="p-6">Se încarcă detaliile comenzii...</div>;
  }

  if (!order) {
    return <div className="p-6">Comanda nu a fost găsită.</div>;
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
            onClick={() => router.push("/comenzi")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la comenzi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Header comanda */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                  {renderOrderIcon()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Detaliu comandă</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {order.order_number || "Comandă fără număr"}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-gray-400">
                    {order.projects?.name || "-"}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm text-gray-500 sm:text-base">
                Vezi informațiile complete ale comenzii, articolele, totalurile și
                stadiul aprobării.
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Nr. comandă
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {order.order_number || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Șantier
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {order.projects?.name || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Data comenzii
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {new Date(order.order_date).toLocaleDateString("ro-RO")}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Creată de
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {order.creator_name || "-"}
              </p>
            </div>
          </div>

          {order.notes && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Observații
              </p>
              <p className="mt-2 text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
        </section>

        {/* Actiuni */}
        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleExportPdf}
              className="rounded-xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Export PDF
            </button>

            {profile?.role === "administrator" &&
              order.status === "asteapta_confirmare" && (
                <>
                  <button
                    type="button"
                    onClick={() => updateOrderStatus("refuzata")}
                    disabled={actionLoading}
                    className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {actionLoading ? "Se procesează..." : "Refuză comanda"}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateOrderStatus("aprobata")}
                    disabled={actionLoading}
                    className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {actionLoading ? "Se procesează..." : "Confirmă comanda"}
                  </button>
                </>
              )}

            {order.status === "draft" &&
              (profile?.role === "administrator" ||
                profile?.role === "sef_echipa") && (
                <button
                  type="button"
                  onClick={() => router.push(`/comenzi/${order.id}/editare`)}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Editează comanda
                </button>
              )}
          </div>
        </section>

        {/* Articole */}
        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Articole comandă</h2>
            <p className="mt-1 text-sm text-gray-500">
              Lista produselor și valorile aferente.
            </p>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nu există articole în această comandă.
            </p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-hidden rounded-2xl border border-[#E8E5DE] lg:block">
                <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-4 py-3 text-sm font-semibold text-gray-700">
                  <div className="col-span-1">Nr.</div>
                  <div className="col-span-2">Cod</div>
                  <div className="col-span-3">Denumire</div>
                  <div className="col-span-1">U.M.</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2">P.U.</div>
                  <div className="col-span-2">Valoare totală</div>
                </div>

                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 items-center border-b bg-white px-4 py-4 text-sm last:border-b-0"
                  >
                    <div className="col-span-1 font-semibold text-gray-900">
                      {index + 1}
                    </div>
                    <div className="col-span-2 text-gray-600">
                      {item.article_code || "-"}
                    </div>
                    <div className="col-span-3 font-semibold text-[#0196ff]">
                      {item.article_name}
                    </div>
                    <div className="col-span-1 text-gray-600">
                      {item.unit || "-"}
                    </div>
                    <div className="col-span-1 text-gray-600">
                      {Number(item.quantity).toFixed(0)}
                    </div>
                    <div className="col-span-2 text-gray-700">
                      {Number(item.unit_price).toFixed(2)} lei
                    </div>
                    <div className="col-span-2 font-semibold text-gray-900">
                      {Number(item.line_total).toFixed(2)} lei
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile */}
              <div className="space-y-3 lg:hidden">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#E8E5DE] bg-gray-50 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          Nr.
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {index + 1}
                        </p>
                      </div>

                      <div className="flex-1 text-right">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          Cod
                        </p>
                        <p className="mt-1 break-words text-sm font-medium text-gray-700">
                          {item.article_code || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Denumire
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#0196ff]">
                        {item.article_name}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          Qty
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {Number(item.quantity).toFixed(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          U.M.
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {item.unit || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          P.U.
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {Number(item.unit_price).toFixed(2)} lei
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          V. totală
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {Number(item.line_total).toFixed(2)} lei
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Totaluri */}
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Subtotal articole</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {Number(order.subtotal).toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">TVA 21%</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {Number(order.vat_total).toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] bg-[#0196ff] p-4 text-white shadow-sm">
              <p className="text-sm text-white/80">Total cu TVA</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {Number(order.total_with_vat).toFixed(2)} lei
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
