"use client";

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

  if (loading) {
    return <div className="p-6">Se încarcă comenzile centrului de cost...</div>;
  }

  if (!project) {
    return <div className="p-6">Centrul de cost nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comenzi centru de cost</h1>
            <p className="text-sm text-gray-600">
              Vezi comenzile aprobate aferente proiectului.
            </p>
          </div>

          <button
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la centru de cost
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{project.name}</h2>
              <p className="text-sm text-gray-500">
                Cod centru de cost: {project.cost_center_code || "-"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Beneficiar</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.beneficiary || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Locație</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.project_location || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Număr comenzi</p>
                <p className="mt-1 text-sm font-semibold">{orders.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="mt-2 text-2xl font-bold">
                {totals.subtotal.toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">TVA</p>
              <p className="mt-2 text-2xl font-bold">
                {totals.vat.toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
              <p className="text-sm opacity-90">Total cu TVA</p>
              <p className="mt-2 text-2xl font-bold">
                {totals.total.toFixed(2)} lei
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow">
            <div className="grid grid-cols-4 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              <div>Nr. comandă</div>
              <div>Data</div>
              <div>Subtotal</div>
              <div>Total</div>
            </div>

            {orders.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                Nu există comenzi aprobate pentru acest centru de cost.
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/comenzi/${order.id}`)}
                  className="grid w-full grid-cols-4 border-b px-4 py-3 text-left text-sm transition hover:bg-gray-50 last:border-b-0"
                >
                  <div className="font-semibold">
                    {order.order_number || "-"}
                  </div>
                  <div>
                    {new Date(order.order_date).toLocaleDateString("ro-RO")}
                  </div>
                  <div>{Number(order.subtotal).toFixed(2)} lei</div>
                  <div className="font-semibold">
                    {Number(order.total_with_vat).toFixed(2)} lei
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}