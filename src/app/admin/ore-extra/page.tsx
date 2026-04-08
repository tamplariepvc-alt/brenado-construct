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

type CategoryType = "extra" | "weekend";
type PeriodFilterType = "doua_saptamani" | "zi" | "interval" | "toate";

export default function OreExtraWeekendPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExtraWorkRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [category, setCategory] = useState<CategoryType>("extra");

  const [periodFilter, setPeriodFilter] =
    useState<PeriodFilterType>("doua_saptamani");
  const [selectedDay, setSelectedDay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("placeholder");

  const getTwoWeeksRange = () => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;

    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(thisMonday);
    end.setDate(thisMonday.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      startStr: start.toISOString().split("T")[0],
      endStr: end.toISOString().split("T")[0],
    };
  };

  useEffect(() => {
    const { startStr, endStr } = getTwoWeeksRange();
    setStartDate(startStr);
    setEndDate(endStr);
  }, []);

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

  const getWorkerName = (row: ExtraWorkRow) =>
    workerMap.get(row.worker_id) || "-";

  const getProjectName = (row: ExtraWorkRow) =>
    projectMap.get(row.project_id) || "-";

  const filteredRows = useMemo(() => {
    const { start, end } = getTwoWeeksRange();

    return rows.filter((row) => {
      const rowDate = new Date(`${row.work_date}T00:00:00`);
      const workerName = getWorkerName(row).toLowerCase();
      const projectName = getProjectName(row).toLowerCase();

      const isExtra =
        Number(row.extra_hours || 0) > 0 ||
        Number(row.extra_hours_value || 0) > 0;

      const isWeekend =
        Boolean(row.is_saturday) ||
        Boolean(row.is_sunday) ||
        Number(row.weekend_days_count || 0) > 0 ||
        Number(row.weekend_value || 0) > 0;

      if (category === "extra" && !isExtra) return false;
      if (category === "weekend" && !isWeekend) return false;

      if (periodFilter === "doua_saptamani") {
        if (rowDate < start || rowDate > end) return false;
      }

      if (periodFilter === "zi" && selectedDay) {
        if (row.work_date !== selectedDay) return false;
      }

      if (periodFilter === "interval" && startDate && endDate) {
        const startInterval = new Date(`${startDate}T00:00:00`);
        const endInterval = new Date(`${endDate}T23:59:59`);
        if (rowDate < startInterval || rowDate > endInterval) return false;
      }

      if (
        selectedProjectId !== "placeholder" &&
        selectedProjectId !== "all" &&
        row.project_id !== selectedProjectId
      ) {
        return false;
      }

      if (
        workerSearch.trim() &&
        !workerName.includes(workerSearch.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        projectSearch.trim() &&
        !projectName.includes(projectSearch.trim().toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    category,
    periodFilter,
    selectedDay,
    startDate,
    endDate,
    workerSearch,
    projectSearch,
    selectedProjectId,
    workerMap,
    projectMap,
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
      .update({ extra_hours_paid: true })
      .eq("id", row.id);

    if (error) {
      alert("A apărut o eroare la achitarea orelor.");
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
      .update({ weekend_paid: true })
      .eq("id", row.id);

    if (error) {
      alert("A apărut o eroare la achitarea zilelor de weekend.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadData();
  };

  const exportPdf = () => {
    if (filteredRows.length === 0) {
      alert("Nu există date pentru export.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const now = new Date();

    const title =
      category === "extra" ? "Raport Ore Extra" : "Raport Zile Weekend";

    const periodLabel =
      periodFilter === "doua_saptamani"
        ? "Ultimele 2 saptamani"
        : periodFilter === "zi"
        ? `Zi selectata: ${selectedDay || "-"}`
        : periodFilter === "interval"
        ? `Interval: ${startDate || "-"} - ${endDate || "-"}`
        : "Toate";

    const selectedProjectLabel =
      selectedProjectId === "placeholder"
        ? "Alege santier"
        : selectedProjectId === "all"
        ? "Toate santierele"
        : projectMap.get(selectedProjectId) || "-";

    doc.setFontSize(15);
    doc.text(title, 14, 15);

    doc.setFontSize(9);
    doc.text(
      `Export: ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString(
        "ro-RO"
      )}`,
      14,
      21
    );
    doc.text(`Perioada: ${periodLabel}`, 14, 26);
    doc.text(`Santier selectat: ${selectedProjectLabel}`, 14, 31);
    doc.text(`Nume: ${workerSearch || "-"}`, 14, 36);
    doc.text(`Cautare santier: ${projectSearch || "-"}`, 14, 41);

    if (category === "extra") {
      doc.text(
        `Total valoare ore extra: ${totals.extraValue.toFixed(2)} lei`,
        14,
        46
      );

      autoTable(doc, {
        startY: 51,
        head: [["Nume", "Santier", "Data", "Ore", "Valoare", "Status"]],
        body: filteredRows.map((row) => [
          getWorkerName(row),
          getProjectName(row),
          new Date(row.work_date).toLocaleDateString("ro-RO"),
          Number(row.extra_hours || 0).toFixed(2),
          `${Number(row.extra_hours_value || 0).toFixed(2)} lei`,
          row.extra_hours_paid ? "Achitat" : "Neachitat",
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
        },
        headStyles: {
          fillColor: [147, 51, 234],
        },
        theme: "grid",
      });
    } else {
      doc.text(
        `Total valoare weekend: ${totals.weekendValue.toFixed(2)} lei`,
        14,
        46
      );

      autoTable(doc, {
        startY: 51,
        head: [[
          "Nume",
          "Santier",
          "Data",
          "Sambata",
          "Duminica",
          "Zile",
          "Valoare",
          "Status",
        ]],
        body: filteredRows.map((row) => [
          getWorkerName(row),
          getProjectName(row),
          new Date(row.work_date).toLocaleDateString("ro-RO"),
          row.is_saturday ? "Da" : "Nu",
          row.is_sunday ? "Da" : "Nu",
          Number(row.weekend_days_count || 0).toFixed(2),
          `${Number(row.weekend_value || 0).toFixed(2)} lei`,
          row.weekend_paid ? "Achitat" : "Neachitat",
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
        },
        headStyles: {
          fillColor: [234, 88, 12],
        },
        theme: "grid",
      });
    }

    const fileName =
      category === "extra"
        ? "raport_ore_extra.pdf"
        : "raport_zile_weekend.pdf";

    doc.save(fileName);
  };

  const activeTotal =
    category === "extra" ? totals.extraValue : totals.weekendValue;

  if (loading) {
    return <div className="p-6">Se încarcă datele...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ore Extra & Weekend</h1>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi
          </button>
        </div>

        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={() => setCategory("extra")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              category === "extra"
                ? "bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Ore Extra
          </button>

          <button
            type="button"
            onClick={() => setCategory("weekend")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              category === "weekend"
                ? "bg-gradient-to-b from-orange-500 to-orange-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Weekend
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-white p-4 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Filtru perioadă
              </label>
              <select
                value={periodFilter}
                onChange={(e) =>
                  setPeriodFilter(e.target.value as PeriodFilterType)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="doua_saptamani">Ultimele 2 săptămâni</option>
                <option value="zi">Caută după zi</option>
                <option value="interval">După perioadă</option>
                <option value="toate">Toate</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Șantier
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="placeholder">Alege șantier</option>
                <option value="all">Toate șantierele</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Caută după nume
              </label>
              <input
                type="text"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder="Ex: IONEL"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Caută după șantier
              </label>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Ex: AMENAJARI DABULENI"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            {periodFilter === "zi" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Selectează ziua
                </label>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>
            )}

            {periodFilter === "interval" && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    De la
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Până la
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-xl bg-[#0196ff] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-3xl bg-[#4d95eb] p-5 text-white shadow">
          <p className="text-sm opacity-90">
            {category === "extra" ? "Total ore extra" : "Total zile weekend"}
          </p>
          <p className="mt-2 text-2xl font-bold">
            {activeTotal.toFixed(2)} lei
          </p>
        </div>

        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <div className="rounded-3xl bg-white p-5 text-sm text-gray-500 shadow">
              Nu există înregistrări pentru filtrele selectate.
            </div>
          ) : (
            filteredRows.map((row) => {
              const isPaid =
                category === "extra" ? row.extra_hours_paid : row.weekend_paid;

              return (
                <div key={row.id} className="rounded-3xl bg-white p-4 shadow">
                  <h3 className="text-lg font-bold text-gray-900">
                    {getWorkerName(row)}
                  </h3>

                  <p className="mt-2 text-base text-gray-500">
                    Proiect: {getProjectName(row)}
                  </p>

                  <p className="text-base text-gray-900">
                    Data: {new Date(row.work_date).toLocaleDateString("ro-RO")}
                  </p>

                  {category === "extra" && (
                    <>
                      <p className="mt-2 text-lg text-gray-900">
                        Ore: {Number(row.extra_hours || 0).toFixed(0)}
                      </p>
                      <p className="text-lg text-gray-900">
                        Valoare: {Number(row.extra_hours_value || 0).toFixed(0)} lei
                      </p>

                      <div className="mt-3">
                        <span
                          className={`rounded-xl px-3 py-1.5 text-sm font-semibold text-white ${
                            isPaid ? "bg-green-600" : "bg-red-600"
                          }`}
                        >
                          {isPaid ? "Achitat" : "Neachitat"}
                        </span>
                      </div>

                      {!row.extra_hours_paid && (
                        <button
                          type="button"
                          onClick={() => handleMarkExtraPaid(row)}
                          disabled={processingId === row.id}
                          className="mt-4 w-full rounded-xl bg-gradient-to-b from-fuchsia-500 to-purple-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
                        >
                          Achită ore
                        </button>
                      )}
                    </>
                  )}

                  {category === "weekend" && (
                    <>
                      <p className="mt-2 text-lg text-gray-900">
                        Sâmbătă: {row.is_saturday ? "Da" : "Nu"}
                      </p>
                      <p className="text-lg text-gray-900">
                        Duminică: {row.is_sunday ? "Da" : "Nu"}
                      </p>
                      <p className="text-lg text-gray-900">
                        Zile: {Number(row.weekend_days_count || 0).toFixed(0)}
                      </p>
                      <p className="text-lg text-gray-900">
                        Valoare: {Number(row.weekend_value || 0).toFixed(0)} lei
                      </p>

                      <div className="mt-3">
                        <span
                          className={`rounded-xl px-3 py-1.5 text-sm font-semibold text-white ${
                            isPaid ? "bg-green-600" : "bg-red-600"
                          }`}
                        >
                          {isPaid ? "Achitat" : "Neachitat"}
                        </span>
                      </div>

                      {!row.weekend_paid && (
                        <button
                          type="button"
                          onClick={() => handleMarkWeekendPaid(row)}
                          disabled={processingId === row.id}
                          className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
                        >
                          Achită zile weekend
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}