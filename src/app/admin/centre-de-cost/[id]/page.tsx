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

type Worker = {
  id: string;
  full_name: string;
  job_title: string | null;
  is_active: boolean;
};

type ProjectWorker = {
  id: string;
  worker_id: string;
  workers?: {
    id: string;
    full_name: string;
    job_title: string | null;
    is_active: boolean;
  }[] | null;
};

export default function CentruDeCostDetaliuPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [projectWorkers, setProjectWorkers] = useState<ProjectWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);
  const [removingWorkerId, setRemovingWorkerId] = useState<string | null>(null);

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

    const { data: workersData, error: workersError } = await supabase
      .from("workers")
      .select("id, full_name, job_title, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    const { data: projectWorkersData, error: projectWorkersError } = await supabase
      .from("project_workers")
      .select(`
        id,
        worker_id,
        workers:worker_id (
          id,
          full_name,
          job_title,
          is_active
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    setProject(projectData as ProjectDetails);

    if (!ordersError && ordersData) {
      setOrders(ordersData as ApprovedOrder[]);
    }

    if (!workersError && workersData) {
      setAllWorkers(workersData as Worker[]);
    }

    if (!projectWorkersError && projectWorkersData) {
      setProjectWorkers(projectWorkersData as ProjectWorker[]);
    }

    setLoading(false);
  };

  useEffect(() => {
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

  const assignedWorkerIds = useMemo(() => {
    return projectWorkers.map((item) => item.worker_id);
  }, [projectWorkers]);

  const availableWorkers = useMemo(() => {
    return allWorkers.filter((worker) => !assignedWorkerIds.includes(worker.id));
  }, [allWorkers, assignedWorkerIds]);

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const handleAddWorker = async () => {
    if (!selectedWorkerId) {
      alert("Selectează un muncitor.");
      return;
    }

    setSavingWorker(true);

    const { error } = await supabase.from("project_workers").insert({
      project_id: projectId,
      worker_id: selectedWorkerId,
    });

    if (error) {
      alert("A apărut o eroare la alocarea muncitorului.");
      setSavingWorker(false);
      return;
    }

    setSelectedWorkerId("");
    setSavingWorker(false);
    await loadData();
  };

  const handleRemoveWorker = async (projectWorkerId: string) => {
    setRemovingWorkerId(projectWorkerId);

    const { error } = await supabase
      .from("project_workers")
      .delete()
      .eq("id", projectWorkerId);

    if (error) {
      alert("A apărut o eroare la eliminarea muncitorului.");
      setRemovingWorkerId(null);
      return;
    }

    setRemovingWorkerId(null);
    await loadData();
  };

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
              Vezi informațiile proiectului, comenzile aprobate și muncitorii alocați.
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

              <span className="inline-flex w-fit rounded-full bg-[#0196ff]/10 px-3 py-1 text-sm font-semibold text-[#0196ff]">
                {getProjectStatusLabel(project.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Beneficiar</p>
                <p className="mt-1 text-sm font-semibold">{project.beneficiary || "-"}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Locație</p>
                <p className="mt-1 text-sm font-semibold">{project.project_location || "-"}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Tip proiect</p>
                <p className="mt-1 text-sm font-semibold">{project.project_type || "-"}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Grupă</p>
                <p className="mt-1 text-sm font-semibold">{project.project_group || "-"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Adaugă muncitor la proiect
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  <option value="">Selectează muncitor</option>
                  {availableWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name}{worker.job_title ? ` - ${worker.job_title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddWorker}
                disabled={savingWorker || !selectedWorkerId}
                className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingWorker ? "Se adaugă..." : "Adaugă muncitor"}
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-3 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                <div>Nume</div>
                <div>Funcție</div>
                <div>Acțiune</div>
              </div>

              {projectWorkers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                  Nu există muncitori alocați acestui proiect.
                </div>
              ) : (
                projectWorkers.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-3 items-center border-b px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="font-medium">
                      {item.workers?.[0]?.full_name || "-"}
                    </div>
                    <div>{item.workers?.[0]?.job_title || "-"}</div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveWorker(item.id)}
                        disabled={removingWorkerId === item.id}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                      >
                        {removingWorkerId === item.id ? "Se elimină..." : "Elimină"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">Comenzi aprobate</p>
              <p className="mt-2 text-2xl font-bold">{orders.length}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="mt-2 text-2xl font-bold">{totals.subtotal.toFixed(2)} lei</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">TVA</p>
              <p className="mt-2 text-2xl font-bold">{totals.vat.toFixed(2)} lei</p>
            </div>

            <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
              <p className="text-sm opacity-90">Total cu TVA</p>
              <p className="mt-2 text-2xl font-bold">{totals.total.toFixed(2)} lei</p>
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
                  <div className="font-semibold">{order.order_number || "-"}</div>
                  <div>{new Date(order.order_date).toLocaleDateString("ro-RO")}</div>
                  <div>{Number(order.subtotal).toFixed(2)} lei</div>
                  <div className="font-semibold">{Number(order.total_with_vat).toFixed(2)} lei</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}