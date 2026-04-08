"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ExtraWorkRow = {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number;
  is_saturday: boolean;
  is_sunday: boolean;
  extra_hours_paid: boolean;
  weekend_paid: boolean;
  extra_hours_value: number;
  weekend_days_count: number;
  weekend_value: number;
  total_value: number;
  notes?: string | null;
  created_at: string;
  workers?: {
    id: string;
    full_name: string;
  }[] | null;
  projects?: {
    id: string;
    name: string;
  }[] | null;
};

type WorkerOption = {
  id: string;
  full_name: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

export default function OreExtraPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExtraWorkRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [filterType, setFilterType] = useState<"azi" | "saptamana" | "luna" | "toate">("azi");
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<
    "toate" | "neachitate" | "ore_neachitate" | "weekend_neachitat" | "tot_achitat"
  >("toate");

  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);

    const { data: extraData, error: extraError } = await supabase
      .from("extra_work")
      .select(`
        id,
        project_id,
        worker_id,
        work_date,
        extra_hours,
        is_saturday,
        is_sunday,
        extra_hours_paid,
        weekend_paid,
        extra_hours_value,
        weekend_days_count,
        weekend_value,
        total_value,
        notes,
        created_at,
        workers:worker_id (
          id,
          full_name
        ),
        projects:project_id (
          id,
          name
        )
      `)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: workersData } = await supabase
      .from("workers")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });

    if (!extraError && extraData) {
      setRows(extraData as ExtraWorkRow[]);
    } else {
      setRows([]);
    }

    setWorkers((workersData || []) as WorkerOption[]);
    setProjects((projectsData || []) as ProjectOption[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);

    return rows.filter((row) => {
      const rowDate = new Date(row.work_date);

      if (filterType === "azi" && row.work_date !== todayString) {
        return false;
      }

      if (filterType === "saptamana") {
        const temp = new Date(rowDate);
        temp.setHours(0, 0, 0, 0);
        if (temp < startOfWeek) return false;
      }

      if (filterType === "luna" && !row.work_date.startsWith(selectedMonth)) {
        return false;
      }

      if (selectedWorkerId && row.worker_id !== selectedWorkerId) {
        return false;
      }

      if (selectedProjectId && row.project_id !== selectedProjectId) {
        return false;
      }

      if (paymentFilter === "neachitate" && row.extra_hours_paid && row.weekend_paid) {
        return false;
      }

      if (paymentFilter === "ore_neachitate" && row.extra_hours_paid) {
        return false;
      }

      if (paymentFilter === "weekend_neachitat" && row.weekend_paid) {
        return false;
      }

      if (paymentFilter === "tot_achitat" && !(row.extra_hours_paid && row.weekend_paid)) {
        return false;
      }

      return true;
    });
  }, [rows, filterType, selectedMonth, selectedWorkerId, selectedProjectId, paymentFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.extraHours += Number(row.extra_hours || 0);
        acc.extraValue += Number(row.extra_hours_value || 0);
        acc.weekendDays += Number(row.weekend_days_count || 0);
        acc.weekendValue += Number(row.weekend_value || 0);
        acc.total += Number(row.total_value || 0);
        return acc;
      },
      {
        extraHours: 0,
        extraValue: 0,
        weekendDays: 0,
        weekendValue: 0,
        total: 0,
      }
    );
  }, [filteredRows]);

  const getWorkerName = (row: ExtraWorkRow) => row.workers?.[0]?.full_name || "-";
  const getProjectName = (row: ExtraWorkRow) => row.projects?.[0]?.name || "-";

  const handleMarkExtraPaid = async (rowId: string) => {
    setProcessingId(rowId);
    const { error } = await supabase
      .from("extra_work")
      .update({ extra_hours_paid: true })
      .eq("id", rowId);

    if (error) {
      alert("A apărut o eroare la achitarea orelor extra.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const handleMarkWeekendPaid = async (rowId: string) => {
    setProcessingId(rowId);
    const { error } = await supabase
      .from("extra_work")
      .update({ weekend_paid: true })
      .eq("id", rowId);

    if (error) {
      alert("A apărut o eroare la achitarea weekendului.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const handleMarkAllPaid = async (rowId: string) => {
    setProcessingId(rowId);
    const { error } = await supabase
      .from("extra_work")
      .update({
        extra_hours_paid: true,
        weekend_paid: true,
      })
      .eq("id", rowId);

    if (error) {
      alert("A apărut o eroare la achitarea completă.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const exportCsv = () => {
    if (filteredRows.length === 0) {
      alert("Nu există date pentru export.");
      return;
    }

    const headers = [
      "Data",
      "Muncitor",
      "Proiect",
      "Ore extra",
      "Valoare ore extra",
      "Sambata",
      "Duminica",
      "Zile weekend",
      "Valoare weekend",
      "Total",
      "Ore achitate",
      "Weekend achitat",
    ];

    const csvRows = filteredRows.map((row) => [
      row.work_date,
      getWorkerName(row),
      getProjectName(row),
      Number(row.extra_hours || 0).toFixed(2),
      Number(row.extra_hours_value || 0).toFixed(2),
      row.is_saturday ? "Da" : "Nu",
      row.is_sunday ? "Da" : "Nu",
      Number(row.weekend_days_count || 0).toFixed(2),
      Number(row.weekend_value || 0).toFixed(2),
      Number(row.total_value || 0).toFixed(2),
      row.extra_hours_paid ? "Da" : "Nu",
      row.weekend_paid ? "Da" : "Nu",
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    link.href = url;
    link.setAttribute("download", `raport_ore_extra_weekend_${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="p-6">Se încarcă orele extra...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ore Extra + Weekend</h1>
            <p className="text-sm text-gray-600">
              Vezi, filtrează, achită și exportă rapoartele de ore extra și weekend.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Înapoi la panou admin
            </button>

            <button
              onClick={exportCsv}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              Export raport
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filtru perioadă
              </label>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "azi" | "saptamana" | "luna" | "toate")
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="azi">Azi</option>
                <option value="saptamana">Săptămâna curentă</option>
                <option value="luna">Luna selectată</option>
                <option value="toate">Toate</option>
              </select>
            </div>

            {filterType === "luna" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Selectează luna
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Muncitor
              </label>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="">Toți muncitorii</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Proiect
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="">Toate proiectele</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status plată
              </label>
              <select
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(
                    e.target.value as
                      | "toate"
                      | "neachitate"
                      | "ore_neachitate"
                      | "weekend_neachitat"
                      | "tot_achitat"
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="toate">Toate</option>
                <option value="neachitate">Orice neachitat</option>
                <option value="ore_neachitate">Ore neachitate</option>
                <option value="weekend_neachitat">Weekend neachitat</option>
                <option value="tot_achitat">Tot achitat</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Ore extra</p>
            <p className="mt-2 text-2xl font-bold">
              {totals.extraHours.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Valoare ore extra</p>
            <p className="mt-2 text-2xl font-bold">
              {totals.extraValue.toFixed(2)} lei
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Zile weekend</p>
            <p className="mt-2 text-2xl font-bold">
              {totals.weekendDays.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Valoare weekend</p>
            <p className="mt-2 text-2xl font-bold">
              {totals.weekendValue.toFixed(2)} lei
            </p>
          </div>

          <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
            <p className="text-sm opacity-90">Total general</p>
            <p className="mt-2 text-2xl font-bold">
              {totals.total.toFixed(2)} lei
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {filteredRows.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow">
              Nu există înregistrări pentru filtrele selectate.
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl bg-white p-5 shadow"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getWorkerName(row)}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Proiect: <span className="font-medium text-gray-700">{getProjectName(row)}</span>
                    </p>

                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <span className="font-medium text-gray-500">Data:</span>{" "}
                        {new Date(row.work_date).toLocaleDateString("ro-RO")}
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Ore extra:</span>{" "}
                        {Number(row.extra_hours || 0).toFixed(2)}
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Valoare ore extra:</span>{" "}
                        {Number(row.extra_hours_value || 0).toFixed(2)} lei
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Zile weekend:</span>{" "}
                        {Number(row.weekend_days_count || 0).toFixed(2)}
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Sâmbătă:</span>{" "}
                        {row.is_saturday ? "Da" : "Nu"}
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Duminică:</span>{" "}
                        {row.is_sunday ? "Da" : "Nu"}
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Valoare weekend:</span>{" "}
                        {Number(row.weekend_value || 0).toFixed(2)} lei
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">Total:</span>{" "}
                        <span className="font-semibold text-gray-900">
                          {Number(row.total_value || 0).toFixed(2)} lei
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          row.extra_hours_paid
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        Ore: {row.extra_hours_paid ? "Achitate" : "Neachitate"}
                      </span>

                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          row.weekend_paid
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        Weekend: {row.weekend_paid ? "Achitat" : "Neachitat"}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 lg:w-[220px]">
                    <button
                      type="button"
                      onClick={() => handleMarkExtraPaid(row.id)}
                      disabled={processingId === row.id || row.extra_hours_paid}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      Achită ore
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkWeekendPaid(row.id)}
                      disabled={processingId === row.id || row.weekend_paid}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      Achită weekend
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkAllPaid(row.id)}
                      disabled={
                        processingId === row.id ||
                        (row.extra_hours_paid && row.weekend_paid)
                      }
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      Achită tot
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}