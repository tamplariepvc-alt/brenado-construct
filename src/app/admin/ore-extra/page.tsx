"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<
    "azi" | "saptamana" | "luna" | "toate"
  >("azi");
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
      2,
      "0"
    )}`
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<
    "toate" | "ore" | "weekend"
  >("toate");
  const [paymentFilter, setPaymentFilter] = useState<
    | "toate"
    | "orice_neachitat"
    | "ore_neachitate"
    | "weekend_neachitat"
    | "tot_achitat"
  >("toate");

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
        created_at
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

  const workerMap = useMemo(() => {
    return new Map(workers.map((worker) => [worker.id, worker.full_name]));
  }, [workers]);

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.name]));
  }, [projects]);

  const getWorkerName = (row: ExtraWorkRow) => workerMap.get(row.worker_id) || "-";
  const getProjectName = (row: ExtraWorkRow) => projectMap.get(row.project_id) || "-";

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
      const hasExtra =
        Number(row.extra_hours || 0) > 0 ||
        Number(row.extra_hours_value || 0) > 0;

      const hasWeekend =
        Boolean(row.is_saturday) ||
        Boolean(row.is_sunday) ||
        Number(row.weekend_days_count || 0) > 0 ||
        Number(row.weekend_value || 0) > 0;

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

      if (entryTypeFilter === "ore" && !hasExtra) {
        return false;
      }

      if (entryTypeFilter === "weekend" && !hasWeekend) {
        return false;
      }

      if (
        paymentFilter === "orice_neachitat" &&
        row.extra_hours_paid &&
        row.weekend_paid
      ) {
        return false;
      }

      if (paymentFilter === "ore_neachitate" && (row.extra_hours_paid || !hasExtra)) {
        return false;
      }

      if (
        paymentFilter === "weekend_neachitat" &&
        (row.weekend_paid || !hasWeekend)
      ) {
        return false;
      }

      if (paymentFilter === "tot_achitat") {
        const extraOk = !hasExtra || row.extra_hours_paid;
        const weekendOk = !hasWeekend || row.weekend_paid;
        if (!(extraOk && weekendOk)) return false;
      }

      return true;
    });
  }, [
    rows,
    filterType,
    selectedMonth,
    selectedWorkerId,
    selectedProjectId,
    entryTypeFilter,
    paymentFilter,
  ]);

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

  const handleMarkExtraPaid = async (row: ExtraWorkRow) => {
    setProcessingId(row.id);

    const { error } = await supabase
      .from("extra_work")
      .update({
        extra_hours_paid: true,
        total_value:
          Number(row.extra_hours_value || 0) +
          Number(row.weekend_value || 0),
      })
      .eq("id", row.id);

    if (error) {
      alert("A apărut o eroare la achitarea orelor extra.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const handleMarkWeekendPaid = async (row: ExtraWorkRow) => {
    setProcessingId(row.id);

    const { error } = await supabase
      .from("extra_work")
      .update({
        weekend_paid: true,
        total_value:
          Number(row.extra_hours_value || 0) +
          Number(row.weekend_value || 0),
      })
      .eq("id", row.id);

    if (error) {
      alert("A apărut o eroare la achitarea weekendului.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const handleMarkAllPaid = async (row: ExtraWorkRow) => {
    setProcessingId(row.id);

    const { error } = await supabase
      .from("extra_work")
      .update({
        extra_hours_paid: true,
        weekend_paid: true,
        total_value:
          Number(row.extra_hours_value || 0) +
          Number(row.weekend_value || 0),
      })
      .eq("id", row.id);

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
      "Ore achitate",
      "Sambata",
      "Duminica",
      "Zile weekend",
      "Valoare weekend",
      "Weekend achitat",
      "Total",
    ];

    const csvRows = filteredRows.map((row) => [
      row.work_date,
      getWorkerName(row),
      getProjectName(row),
      Number(row.extra_hours || 0).toFixed(2),
      Number(row.extra_hours_value || 0).toFixed(2),
      row.extra_hours_paid ? "Da" : "Nu",
      row.is_saturday ? "Da" : "Nu",
      row.is_sunday ? "Da" : "Nu",
      Number(row.weekend_days_count || 0).toFixed(2),
      Number(row.weekend_value || 0).toFixed(2),
      row.weekend_paid ? "Da" : "Nu",
      Number(row.total_value || 0).toFixed(2),
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
    link.href = url;
    link.setAttribute("download", `raport_ore_extra_weekend_${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPdf = () => {
    if (filteredRows.length === 0) {
      alert("Nu există date pentru export.");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}.${String(
      now.getMonth() + 1
    ).padStart(2, "0")}.${now.getFullYear()}`;

    doc.setFontSize(16);
    doc.text("Raport Ore Extra + Weekend", 14, 15);

    doc.setFontSize(10);
    doc.text(`Data export: ${stamp}`, 14, 21);

    doc.text(
      `Total ore extra: ${totals.extraHours.toFixed(2)} | Valoare ore extra: ${totals.extraValue.toFixed(
        2
      )} lei | Zile weekend: ${totals.weekendDays.toFixed(
        2
      )} | Valoare weekend: ${totals.weekendValue.toFixed(
        2
      )} lei | Total general: ${totals.total.toFixed(2)} lei`,
      14,
      27
    );

    autoTable(doc, {
      startY: 32,
      head: [[
        "Data",
        "Muncitor",
        "Proiect",
        "Ore extra",
        "Val. ore",
        "Ore achitate",
        "Sâmbătă",
        "Duminică",
        "Zile weekend",
        "Val. weekend",
        "Weekend achitat",
        "Total",
      ]],
      body: filteredRows.map((row) => [
        new Date(row.work_date).toLocaleDateString("ro-RO"),
        getWorkerName(row),
        getProjectName(row),
        Number(row.extra_hours || 0).toFixed(2),
        `${Number(row.extra_hours_value || 0).toFixed(2)} lei`,
        row.extra_hours_paid ? "Da" : "Nu",
        row.is_saturday ? "Da" : "Nu",
        row.is_sunday ? "Da" : "Nu",
        Number(row.weekend_days_count || 0).toFixed(2),
        `${Number(row.weekend_value || 0).toFixed(2)} lei`,
        row.weekend_paid ? "Da" : "Nu",
        `${Number(row.total_value || 0).toFixed(2)} lei`,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [1, 150, 255],
      },
      theme: "grid",
    });

    doc.save(`raport_ore_extra_weekend_${stamp.replace(/\./g, "-")}.pdf`);
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
              Vezi separat orele extra și zilele lucrate în weekend.
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
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Export CSV
            </button>

            <button
              onClick={exportPdf}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filtru perioadă
              </label>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(
                    e.target.value as "azi" | "saptamana" | "luna" | "toate"
                  )
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
                Tip înregistrare
              </label>
              <select
                value={entryTypeFilter}
                onChange={(e) =>
                  setEntryTypeFilter(
                    e.target.value as "toate" | "ore" | "weekend"
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="toate">Toate</option>
                <option value="ore">Doar ore extra</option>
                <option value="weekend">Doar weekend</option>
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
                      | "orice_neachitat"
                      | "ore_neachitate"
                      | "weekend_neachitat"
                      | "tot_achitat"
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="toate">Toate</option>
                <option value="orice_neachitat">Orice neachitat</option>
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
            filteredRows.map((row) => {
              const hasExtra =
                Number(row.extra_hours || 0) > 0 ||
                Number(row.extra_hours_value || 0) > 0;

              const hasWeekend =
                Boolean(row.is_saturday) ||
                Boolean(row.is_sunday) ||
                Number(row.weekend_days_count || 0) > 0 ||
                Number(row.weekend_value || 0) > 0;

              return (
                <div
                  key={row.id}
                  className="rounded-2xl bg-white p-5 shadow"
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getWorkerName(row)}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Proiect:{" "}
                        <span className="font-medium text-gray-700">
                          {getProjectName(row)}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Data:{" "}
                        <span className="font-medium text-gray-700">
                          {new Date(row.work_date).toLocaleDateString("ro-RO")}
                        </span>
                      </p>
                    </div>

                    {hasExtra && (
                      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                        <h4 className="text-sm font-semibold text-purple-900">
                          Ore extra
                        </h4>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-purple-900 md:grid-cols-3">
                          <div>
                            <span className="font-medium">Ore:</span>{" "}
                            {Number(row.extra_hours || 0).toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Valoare:</span>{" "}
                            {Number(row.extra_hours_value || 0).toFixed(2)} lei
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>{" "}
                            {row.extra_hours_paid ? "Achitate" : "Neachitate"}
                          </div>
                        </div>

                        <div className="mt-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              row.extra_hours_paid
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            Ore: {row.extra_hours_paid ? "Achitate" : "Neachitate"}
                          </span>
                        </div>
                      </div>
                    )}

                    {hasWeekend && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                        <h4 className="text-sm font-semibold text-orange-900">
                          Weekend lucrat
                        </h4>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-orange-900 md:grid-cols-3">
                          <div>
                            <span className="font-medium">Sâmbătă:</span>{" "}
                            {row.is_saturday ? "Da" : "Nu"}
                          </div>
                          <div>
                            <span className="font-medium">Duminică:</span>{" "}
                            {row.is_sunday ? "Da" : "Nu"}
                          </div>
                          <div>
                            <span className="font-medium">Zile:</span>{" "}
                            {Number(row.weekend_days_count || 0).toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Valoare:</span>{" "}
                            {Number(row.weekend_value || 0).toFixed(2)} lei
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>{" "}
                            {row.weekend_paid ? "Achitat" : "Neachitat"}
                          </div>
                        </div>

                        <div className="mt-3">
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
                    )}

                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-900">
                        Total înregistrare
                      </p>
                      <p className="mt-1 text-xl font-bold text-blue-900">
                        {Number(row.total_value || 0).toFixed(2)} lei
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 lg:w-[260px]">
                      {hasExtra && (
                        <button
                          type="button"
                          onClick={() => handleMarkExtraPaid(row)}
                          disabled={processingId === row.id || row.extra_hours_paid}
                          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          Achită ore
                        </button>
                      )}

                      {hasWeekend && (
                        <button
                          type="button"
                          onClick={() => handleMarkWeekendPaid(row)}
                          disabled={processingId === row.id || row.weekend_paid}
                          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          Achită weekend
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleMarkAllPaid(row)}
                        disabled={
                          processingId === row.id ||
                          ((!hasExtra || row.extra_hours_paid) &&
                            (!hasWeekend || row.weekend_paid))
                        }
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        Achită tot
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}