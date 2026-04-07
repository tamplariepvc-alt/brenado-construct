"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ProjectDetails = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  project_type: string | null;
  project_group: string | null;
  start_date: string | null;
  execution_deadline: string | null;
  status: string;
  cost_center_code: string | null;
  is_cost_center: boolean | null;
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

export default function CentruDeCostDetaliuPage() {
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
        .select(`
          id,
          name,
          beneficiary,
          project_location,
          project_type,
          project_group,
          start_date,
          execution_deadline,
          status,
          cost_center_code,
          is_cost_center
        `)
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

  const orderTotals = useMemo(() => {
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

  const categoryTotals = useMemo(() => {
    return {
      comenzi: orderTotals.total,
      bonuri: 0,
      facturi: 0,
      transport: 0,
      manopera: 0,
      nedeductibile: 0,
    };
  }, [orderTotals]);

  const projectGrandTotal = useMemo(() => {
    return (
      categoryTotals.comenzi +
      categoryTotals.bonuri +
      categoryTotals.facturi +
      categoryTotals.transport +
      categoryTotals.manopera +
      categoryTotals.nedeductibile
    );
  }, [categoryTotals]);

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };
  
  const getProjectStatusStyle = (status: string) => {
  if (status === "in_asteptare") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "in_lucru") {
    return "bg-yellow-100 text-yellow-800";
  }

  if (status === "finalizat") {
    return "bg-green-100 text-green-800";
  }

  return "bg-gray-100 text-gray-800";
};

  const handleCategoryClick = (key: string) => {
    if (key === "comenzi") {
      router.push(`/admin/centre-de-cost/${projectId}/comenzi`);
      return;
    }

    if (key === "bonuri") {
      router.push(`/admin/centre-de-cost/${projectId}/bonuri`);
      return;
    }

    if (key === "facturi") {
      router.push(`/admin/centre-de-cost/${projectId}/facturi`);
      return;
    }

    if (key === "transport") {
      router.push(`/admin/centre-de-cost/${projectId}/transport`);
      return;
    }

    if (key === "manopera") {
      router.push(`/admin/centre-de-cost/${projectId}/manopera`);
      return;
    }

    if (key === "nedeductibile") {
      router.push(`/admin/centre-de-cost/${projectId}/nedeductibile`);
    }
  };

  const categoryCards = [
    {
      key: "comenzi",
      title: "Comenzi",
      value: categoryTotals.comenzi,
      description: "Comenzi aprobate din proiect",
      active: true,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
    {
      key: "bonuri",
      title: "Bonuri",
      value: categoryTotals.bonuri,
      description: "Bonuri fiscale aferente proiectului",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
    {
      key: "facturi",
      title: "Facturi",
      value: categoryTotals.facturi,
      description: "Facturi aferente proiectului",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
    {
      key: "transport",
      title: "Transport",
      value: categoryTotals.transport,
      description: "Cheltuieli de transport",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
    {
      key: "manopera",
      title: "Manoperă",
      value: categoryTotals.manopera,
      description: "Costuri cu manopera",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
    {
      key: "nedeductibile",
      title: "Nedeductibile",
      value: categoryTotals.nedeductibile,
      description: "Cheltuieli nedeductibile",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
    },
  ];

  if (loading) {
    return <div className="p-6">Se încarcă centrul de cost...</div>;
  }

  if (!project) {
    return <div className="p-6">Centrul de cost nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu centru de cost</h1>
            <p className="text-sm text-gray-600">
              Vezi structura costurilor pe proiect.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/centre-de-cost")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la centre de cost
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{project.name}</h2>
                <p className="text-sm text-gray-500">
                  Cod centru de cost: {project.cost_center_code || "-"}
                </p>
              </div>

<span
  className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${getProjectStatusStyle(
    project.status
  )}`}
>
  {getProjectStatusLabel(project.status)}
</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <p className="text-xs font-medium text-gray-500">Tip proiect</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.project_type || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Grupă</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.project_group || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Data început</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.start_date
                    ? new Date(project.start_date).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Termen execuție</p>
                <p className="mt-1 text-sm font-semibold">
                  {project.execution_deadline
                    ? new Date(project.execution_deadline).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Categorii centru de cost</h2>
              <p className="mt-1 text-sm text-gray-500">
                Fiecare categorie va avea propria funcție și propriile înregistrări.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
{categoryCards.map((card) => (
  <button
    key={card.key}
    type="button"
    onClick={() => handleCategoryClick(card.key)}
    className={`rounded-2xl p-5 text-left shadow transition hover:shadow-md ${card.color}`}
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <h3 className="text-lg font-semibold">{card.title}</h3>
        <p className={`mt-1 text-sm ${card.subColor}`}>
          {card.description}
        </p>
        <p className="mt-4 text-2xl font-bold">
          {card.value.toFixed(2)} lei
        </p>
        <p className={`mt-2 text-xs ${card.subColor}`}>
          {card.active ? "Funcție activă" : "În dezvoltare"}
        </p>
      </div>

      <div className="shrink-0 text-4xl font-light text-gray-400">
        →
      </div>
    </div>
  </button>
))}

              <div className="rounded-2xl bg-[#0196ff] p-5 text-left text-white shadow">
                <h3 className="text-lg font-semibold">Total general proiect</h3>
                <p className="mt-1 text-sm text-white/80">
                  Total cumulat din toate categoriile
                </p>
                <p className="mt-4 text-2xl font-bold">
                  {projectGrandTotal.toFixed(2)} lei (tva inclus)
                </p>
                <p className="mt-2 text-xs text-white/80">
                  Sumar total centru de cost
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}