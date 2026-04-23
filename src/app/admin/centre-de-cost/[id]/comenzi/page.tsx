"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ProjectDetails = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  cost_center_code: string | null;
};

type ApprovedOrder = {
  id: string;
  order_number: string | null;
  order_date: string;
  status: string;
  subtotal: number;
  vat_total: number;
  total_with_vat: number;
  created_at: string;
};

export default function CentruDeCostComenziPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, beneficiary, project_location, cost_center_code")
        .eq("id", projectId)
        .single();

      if (projectError || !projectData) {
        router.push("/admin/centre-de-cost");
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          order_date,
          status,
          subtotal,
          vat_total,
          total_with_vat,
          created_at
        `)
        .eq("project_id", projectId)
        .eq("status", "aprobata")
        .order("created_at", { ascending: false });

      setProject(projectData as ProjectDetails);

      if (!ordersError && ordersData) {
        setOrders(ordersData as ApprovedOrder[]);
      }

      setLoading(false);
    };

    loadData();
  }, [projectId, router]);

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.subtotal += Number(order.subtotal || 0);
        acc.vat += Number(order.vat_total || 0);
        acc.total += Number(order.total_with_vat || 0);
        return acc;
      },
      { subtotal: 0, vat: 0, total: 0 }
    );
  }, [orders]);

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


  if (!project) {
    return <div className="p-6">Centrul de cost nu a fost găsit.</div>;
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
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}`)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la centru de cost
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                  {renderOrderIcon()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Comenzi centru de cost</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {project.name}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-gray-400">
                    Cod centru de cost: {project.cost_center_code || "-"}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm text-gray-500 sm:text-base">
                Vezi comenzile aprobate aferente proiectului și valorile lor
                cumulate.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Beneficiar
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.beneficiary || "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Locație
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.project_location || "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 px-3 py-3 md:col-span-1 col-span-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Număr comenzi
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {orders.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {totals.subtotal.toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">TVA</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {totals.vat.toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] bg-[#0196ff] p-4 text-white shadow-sm">
              <p className="text-sm text-white/80">Total cu TVA</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {totals.total.toFixed(2)} lei
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista comenzi
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {orders.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există comenzi aprobate pentru acest centru de cost.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-3">Nr. comandă</div>
                  <div className="col-span-3">Data</div>
                  <div className="col-span-2">Subtotal</div>
                  <div className="col-span-3">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => router.push(`/comenzi/${order.id}`)}
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-3 text-sm font-semibold text-gray-900">
                      {order.order_number || "-"}
                    </div>

                    <div className="col-span-3 text-sm text-gray-500">
                      {new Date(order.order_date).toLocaleDateString("ro-RO")}
                    </div>

                    <div className="col-span-2 text-sm text-gray-700">
                      {Number(order.subtotal).toFixed(2)} lei
                    </div>

                    <div className="col-span-3 text-sm font-bold text-gray-900">
                      {Number(order.total_with_vat).toFixed(2)} lei
                    </div>

                    <div className="col-span-1 text-right text-2xl font-light text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 lg:hidden">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => router.push(`/comenzi/${order.id}`)}
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderOrderIcon()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900">
                              {order.order_number || "-"}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {new Date(order.order_date).toLocaleDateString("ro-RO")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {Number(order.total_with_vat).toFixed(2)} lei
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Subtotal
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {Number(order.subtotal).toFixed(2)} lei
                      </p>
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
    </div>
  );
}