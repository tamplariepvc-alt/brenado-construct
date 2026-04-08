"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getRomanianLegalHolidays,
  getWorkingDaysInMonthRomania,
} from "@/lib/romanian-working-days";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  status: string;
  cost_center_code: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  monthly_salary: number | null;
  is_active: boolean;
};

type TimeEntry = {
  id: string;
  worker_id: string;
  start_time: string;
  end_time: string | null;
  work_date: string;
  status: string;
};

type ExtraWork = {
  id?: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  extra_hours_value: number | null;
  weekend_days_count: number | null;
  weekend_value: number | null;
  total_value: number | null;
  is_saturday?: boolean | null;
  is_sunday?: boolean | null;
};

type WorkerSummaryRow = {
  worker_id: string;
  worker_name: string;
  monthly_salary: number;
  working_days_in_month: number;
  month_norm_hours: number;
  hourly_rate: number;
  normal_hours: number;
  normal_cost: number;
  extra_hours: number;
  extra_cost: number;
  weekend_days: number;
  weekend_cost: number;
  total_cost: number;
  missing_salary: boolean;
};

type DailyDetailRow = {
  key: string;
  worker_id: string;
  worker_name: string;
  work_date: string;
  hourly_rate: number;
  normal_hours: number;
  normal_cost: number;
  extra_hours: number;
  extra_cost: number;
  weekend_days: number;
  weekend_cost: number;
  total_cost: number;
  missing_salary: boolean;
};

type TabKey = "sumar" | "detaliu" | "muncitori";
type PeriodMode = "tot_proiectul" | "luna";

type HolidayInfo = {
  date: string;
  name: string;
};

type DisplayMeta = {
  workingDays: number;
  normHours: number;
  legalHolidays: HolidayInfo[];
};

const formatMoney = (value: number) => `${value.toFixed(2)} lei`;
const formatHours = (value: number) => `${value.toFixed(2)} h`;

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getDateRangeInclusive = (start: Date, end: Date) => {
  const dates: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor.getTime() <= last.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getWorkingDaysAndHolidaysInRangeRomania = (
  start: Date,
  end: Date
): DisplayMeta => {
  const dates = getDateRangeInclusive(start, end);
  const years = Array.from(new Set(dates.map((date) => date.getFullYear())));
  const holidaysMap = new Map<string, string>();

  years.forEach((year) => {
    getRomanianLegalHolidays(year).forEach((holiday) => {
      holidaysMap.set(holiday.date, holiday.name);
    });
  });

  let workingDays = 0;
  const legalHolidays: HolidayInfo[] = [];

  dates.forEach((date) => {
    const key = toDateKey(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holidayName = holidaysMap.get(key);

    if (holidayName) {
      legalHolidays.push({
        date: key,
        name: holidayName,
      });
    }

    if (!isWeekend && !holidayName) {
      workingDays += 1;
    }
  });

  return {
    workingDays,
    normHours: workingDays * 8,
    legalHolidays,
  };
};

export default function CentruDeCostManoperaPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [extraWorkRows, setExtraWorkRows] = useState<ExtraWork[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
      2,
      "0"
    )}`
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState("toate");
  const [activeTab, setActiveTab] = useState<TabKey>("sumar");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("tot_proiectul");
  const [showFilters, setShowFilters] = useState(false);

  const now = Date.now();

  const getPauseWindowForDate = (dateLike: string | Date) => {
    const d =
      typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);

    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const pauseStart = new Date(year, month, day, 12, 0, 0, 0).getTime();
    const pauseEnd = new Date(year, month, day, 13, 0, 0, 0).getTime();

    return { pauseStart, pauseEnd };
  };

  const getOverlapMs = (
    startMs: number,
    endMs: number,
    overlapStart: number,
    overlapEnd: number
  ) => {
    const start = Math.max(startMs, overlapStart);
    const end = Math.min(endMs, overlapEnd);
    return Math.max(0, end - start);
  };

  const getWorkedMsWithoutPause = (
    startTime: string,
    endTime?: string | null
  ) => {
    const startMs = new Date(startTime).getTime();
    const endMs = endTime ? new Date(endTime).getTime() : now;

    if (endMs <= startMs) return 0;

    let total = endMs - startMs;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0,
      0
    );

    const last = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0,
      0,
      0,
      0
    );

    while (cursor.getTime() <= last.getTime()) {
      const { pauseStart, pauseEnd } = getPauseWindowForDate(cursor);
      total -= getOverlapMs(startMs, endMs, pauseStart, pauseEnd);
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(0, total);
  };

  const periodLabel = useMemo(() => {
    if (periodMode === "tot_proiectul") {
      return "De la inceputul proiectului";
    }

    return new Date(`${selectedMonth}-01`).toLocaleDateString("ro-RO", {
      month: "long",
      year: "numeric",
    });
  }, [periodMode, selectedMonth]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          beneficiary,
          project_location,
          status,
          cost_center_code
        `)
        .eq("id", projectId)
        .single();

      if (projectError || !projectData) {
        router.push("/admin/centre-de-cost");
        return;
      }

      const { data: workersData } = await supabase
        .from("workers")
        .select("id, full_name, monthly_salary, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      let timeEntriesQuery = supabase
        .from("time_entries")
        .select(`
          id,
          worker_id,
          start_time,
          end_time,
          work_date,
          status
        `)
        .eq("project_id", projectId)
        .not("end_time", "is", null)
        .order("work_date", { ascending: false })
        .order("start_time", { ascending: false });

      let extraWorkQuery = supabase
        .from("extra_work")
        .select(`
          id,
          worker_id,
          work_date,
          extra_hours,
          extra_hours_value,
          weekend_days_count,
          weekend_value,
          total_value,
          is_saturday,
          is_sunday
        `)
        .eq("project_id", projectId)
        .order("work_date", { ascending: false });

      if (periodMode === "luna") {
        const [year, month] = selectedMonth.split("-").map(Number);
        const monthStart = `${selectedMonth}-01`;
        const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];

        timeEntriesQuery = timeEntriesQuery
          .gte("work_date", monthStart)
          .lte("work_date", monthEnd);

        extraWorkQuery = extraWorkQuery
          .gte("work_date", monthStart)
          .lte("work_date", monthEnd);
      }

      const [{ data: timeEntriesData }, { data: extraWorkData }] =
        await Promise.all([timeEntriesQuery, extraWorkQuery]);

      setProject(projectData as Project);
      setWorkers((workersData as Worker[]) || []);
      setTimeEntries((timeEntriesData as TimeEntry[]) || []);
      setExtraWorkRows((extraWorkData as ExtraWork[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, router, selectedMonth, periodMode]);

  const workerMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((worker) => {
      map.set(worker.id, worker);
    });
    return map;
  }, [workers]);

  const monthMeta = useMemo<DisplayMeta>(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const workingDays = getWorkingDaysInMonthRomania(year, month - 1);
    const normHours = workingDays * 8;
    const legalHolidays = getRomanianLegalHolidays(year).filter((holiday) =>
      holiday.date.startsWith(selectedMonth)
    );

    return {
      workingDays,
      normHours,
      legalHolidays,
    };
  }, [selectedMonth]);

  const projectMeta = useMemo<DisplayMeta>(() => {
    const allProjectDates = [
      ...timeEntries.map((entry) => entry.work_date),
      ...extraWorkRows.map((row) => row.work_date),
    ]
      .filter(Boolean)
      .sort();

    if (allProjectDates.length === 0) {
      return {
        workingDays: 0,
        normHours: 0,
        legalHolidays: [],
      };
    }

    const startDate = new Date(`${allProjectDates[0]}T00:00:00`);
    const endDate = new Date(
      `${allProjectDates[allProjectDates.length - 1]}T00:00:00`
    );

    return getWorkingDaysAndHolidaysInRangeRomania(startDate, endDate);
  }, [timeEntries, extraWorkRows]);

  const displayMeta = periodMode === "luna" ? monthMeta : projectMeta;

  const dailyDetailRows = useMemo<DailyDetailRow[]>(() => {
    const dailyNormalMap = new Map<
      string,
      {
        worker_id: string;
        work_date: string;
        normal_hours: number;
      }
    >();

    timeEntries.forEach((entry) => {
      if (!entry.end_time) return;

      const workedMs = getWorkedMsWithoutPause(entry.start_time, entry.end_time);
      const workedHours = workedMs / (1000 * 60 * 60);

      if (workedHours <= 0) return;

      const key = `${entry.worker_id}__${entry.work_date}`;
      const current = dailyNormalMap.get(key);

      if (!current) {
        dailyNormalMap.set(key, {
          worker_id: entry.worker_id,
          work_date: entry.work_date,
          normal_hours: workedHours,
        });
      } else {
        current.normal_hours += workedHours;
        dailyNormalMap.set(key, current);
      }
    });

    const dailyExtraMap = new Map<
      string,
      {
        worker_id: string;
        work_date: string;
        extra_hours: number;
        extra_cost: number;
        weekend_days: number;
        weekend_cost: number;
      }
    >();

    extraWorkRows.forEach((row) => {
      const key = `${row.worker_id}__${row.work_date}`;
      const current = dailyExtraMap.get(key);

      const payload = {
        worker_id: row.worker_id,
        work_date: row.work_date,
        extra_hours: Number(row.extra_hours || 0),
        extra_cost: Number(row.extra_hours_value || 0),
        weekend_days: Number(row.weekend_days_count || 0),
        weekend_cost: Number(row.weekend_value || 0),
      };

      if (!current) {
        dailyExtraMap.set(key, payload);
      } else {
        current.extra_hours += payload.extra_hours;
        current.extra_cost += payload.extra_cost;
        current.weekend_days += payload.weekend_days;
        current.weekend_cost += payload.weekend_cost;
        dailyExtraMap.set(key, current);
      }
    });

    const allKeys = Array.from(
      new Set([...dailyNormalMap.keys(), ...dailyExtraMap.keys()])
    );

    const rows = allKeys.map((key) => {
      const normal = dailyNormalMap.get(key);
      const extra = dailyExtraMap.get(key);

      const workerId = normal?.worker_id || extra?.worker_id || "";
      const workDate = normal?.work_date || extra?.work_date || "";
      const worker = workerMap.get(workerId);

      const monthlySalary = Number(worker?.monthly_salary || 0);
      const hourlyRate =
        displayMeta.normHours > 0 ? monthlySalary / displayMeta.normHours : 0;

      const normalHours = Number(normal?.normal_hours || 0);
      const normalCost = normalHours * hourlyRate;
      const extraHours = Number(extra?.extra_hours || 0);
      const extraCost = Number(extra?.extra_cost || 0);
      const weekendDays = Number(extra?.weekend_days || 0);
      const weekendCost = Number(extra?.weekend_cost || 0);

      return {
        key,
        worker_id: workerId,
        worker_name: worker?.full_name || "-",
        work_date: workDate,
        hourly_rate: hourlyRate,
        normal_hours: normalHours,
        normal_cost: normalCost,
        extra_hours: extraHours,
        extra_cost: extraCost,
        weekend_days: weekendDays,
        weekend_cost: weekendCost,
        total_cost: normalCost + extraCost + weekendCost,
        missing_salary: monthlySalary <= 0,
      };
    });

    return rows
      .filter((row) =>
        selectedWorkerId === "toate" ? true : row.worker_id === selectedWorkerId
      )
      .sort((a, b) => {
        const dateDiff =
          new Date(b.work_date).getTime() - new Date(a.work_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.worker_name.localeCompare(b.worker_name, "ro");
      });
  }, [
    timeEntries,
    extraWorkRows,
    workerMap,
    selectedWorkerId,
    displayMeta.normHours,
    now,
  ]);

  const workerSummaryRows = useMemo<WorkerSummaryRow[]>(() => {
    const map = new Map<string, WorkerSummaryRow>();

    workers.forEach((worker) => {
      const monthlySalary = Number(worker.monthly_salary || 0);
      const hourlyRate =
        displayMeta.normHours > 0 ? monthlySalary / displayMeta.normHours : 0;

      map.set(worker.id, {
        worker_id: worker.id,
        worker_name: worker.full_name,
        monthly_salary: monthlySalary,
        working_days_in_month: displayMeta.workingDays,
        month_norm_hours: displayMeta.normHours,
        hourly_rate: hourlyRate,
        normal_hours: 0,
        normal_cost: 0,
        extra_hours: 0,
        extra_cost: 0,
        weekend_days: 0,
        weekend_cost: 0,
        total_cost: 0,
        missing_salary: monthlySalary <= 0,
      });
    });

    dailyDetailRows.forEach((row) => {
      const current = map.get(row.worker_id);

      if (!current) return;

      current.normal_hours += row.normal_hours;
      current.normal_cost += row.normal_cost;
      current.extra_hours += row.extra_hours;
      current.extra_cost += row.extra_cost;
      current.weekend_days += row.weekend_days;
      current.weekend_cost += row.weekend_cost;
      current.total_cost += row.total_cost;

      map.set(row.worker_id, current);
    });

    return Array.from(map.values())
      .filter((row) =>
        selectedWorkerId === "toate" ? true : row.worker_id === selectedWorkerId
      )
      .filter(
        (row) =>
          row.normal_hours > 0 ||
          row.extra_hours > 0 ||
          row.weekend_days > 0 ||
          row.total_cost > 0
      )
      .sort((a, b) => b.total_cost - a.total_cost);
  }, [workers, dailyDetailRows, selectedWorkerId, displayMeta]);

  const summaryCards = useMemo(() => {
    const totals = workerSummaryRows.reduce(
      (acc, row) => {
        acc.totalCost += row.total_cost;
        acc.normalHours += row.normal_hours;
        acc.normalCost += row.normal_cost;
        acc.extraHours += row.extra_hours;
        acc.extraCost += row.extra_cost;
        acc.weekendDays += row.weekend_days;
        acc.weekendCost += row.weekend_cost;
        return acc;
      },
      {
        totalCost: 0,
        normalHours: 0,
        normalCost: 0,
        extraHours: 0,
        extraCost: 0,
        weekendDays: 0,
        weekendCost: 0,
      }
    );

    const workersCount = workerSummaryRows.length;
    const averageHourlyCost =
      totals.normalHours > 0 ? totals.normalCost / totals.normalHours : 0;

    return {
      ...totals,
      workersCount,
      averageHourlyCost,
    };
  }, [workerSummaryRows]);

  const topWorkers = useMemo(() => {
    return workerSummaryRows.slice(0, 5);
  }, [workerSummaryRows]);

  const handleExportPdf = () => {
    if (!project) return;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const titleMap: Record<TabKey, string> = {
      sumar: "Raport manopera - Sumar",
      detaliu: "Raport manopera - Detaliu pe zile",
      muncitori: "Raport manopera - Pe muncitori",
    };

    doc.setFontSize(16);
    doc.text(titleMap[activeTab], 14, 14);

    doc.setFontSize(11);
    doc.text(`Proiect: ${project.name}`, 14, 22);
    doc.text(`Cod centru de cost: ${project.cost_center_code || "-"}`, 14, 28);
    doc.text(`Beneficiar: ${project.beneficiary || "-"}`, 14, 34);
    doc.text(`Locatie: ${project.project_location || "-"}`, 14, 40);
    doc.text(`Perioada: ${periodLabel}`, 14, 46);

    if (activeTab === "sumar") {
      const summaryBody = [
        ["Total manoperă", formatMoney(summaryCards.totalCost)],
        ["Cost ore normale", formatMoney(summaryCards.normalCost)],
        ["Cost ore extra", formatMoney(summaryCards.extraCost)],
        ["Cost weekend", formatMoney(summaryCards.weekendCost)],
        ["Ore normale", formatHours(summaryCards.normalHours)],
        ["Ore extra", formatHours(summaryCards.extraHours)],
        ["Zile weekend", String(summaryCards.weekendDays)],
        ["Muncitori implicați", String(summaryCards.workersCount)],
        ["Cost mediu / oră normală", formatMoney(summaryCards.averageHourlyCost)],
        [
          periodMode === "tot_proiectul"
            ? "Zile lucrătoare proiect"
            : "Zile lucrătoare lună",
          String(displayMeta.workingDays),
        ],
        [
          periodMode === "tot_proiectul" ? "Normă proiect" : "Normă lunară",
          `${displayMeta.normHours} ore`,
        ],
        ["Sărbători legale", String(displayMeta.legalHolidays.length)],
      ];

      autoTable(doc, {
        startY: 54,
        head: [["Categorie", "Valoare"]],
        body: summaryBody,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [1, 150, 255],
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 8;

      if (displayMeta.legalHolidays.length > 0) {
        autoTable(doc, {
          startY: finalY,
          head: [["Data", "Sărbătoare legală"]],
          body: displayMeta.legalHolidays.map((holiday) => [
            holiday.date,
            holiday.name,
          ]),
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [107, 114, 128],
          },
        });

        finalY = (doc as any).lastAutoTable.finalY + 8;
      }

      const topRows = topWorkers.map((worker, index) => [
        `#${index + 1}`,
        worker.worker_name,
        formatHours(worker.normal_hours),
        formatHours(worker.extra_hours),
        String(worker.weekend_days),
        formatMoney(worker.total_cost),
      ]);

      autoTable(doc, {
        startY: finalY,
        head: [["Top", "Muncitor", "Ore normale", "Ore extra", "Weekend", "Cost total"]],
        body: topRows,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [34, 197, 94],
        },
      });
    }

    if (activeTab === "detaliu") {
      const detailRows = dailyDetailRows.map((row) => [
        new Date(row.work_date).toLocaleDateString("ro-RO"),
        row.worker_name,
        formatMoney(row.hourly_rate),
        formatHours(row.normal_hours),
        formatMoney(row.normal_cost),
        formatHours(row.extra_hours),
        formatMoney(row.extra_cost),
        String(row.weekend_days),
        formatMoney(row.weekend_cost),
        formatMoney(row.total_cost),
      ]);

      autoTable(doc, {
        startY: 54,
        head: [[
          "Data",
          "Muncitor",
          "Cost/oră",
          "Ore normale",
          "Cost normale",
          "Ore extra",
          "Cost extra",
          "Weekend",
          "Cost weekend",
          "Cost total",
        ]],
        body: detailRows,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
        },
        headStyles: {
          fillColor: [249, 115, 22],
        },
      });
    }

    if (activeTab === "muncitori") {
      const workerRows = workerSummaryRows.map((row) => [
        row.worker_name,
        row.monthly_salary > 0 ? formatMoney(row.monthly_salary) : "Salariu lipsă",
        String(row.working_days_in_month),
        `${row.month_norm_hours} h`,
        formatMoney(row.hourly_rate),
        formatHours(row.normal_hours),
        formatMoney(row.normal_cost),
        formatHours(row.extra_hours),
        formatMoney(row.extra_cost),
        String(row.weekend_days),
        formatMoney(row.weekend_cost),
        formatMoney(row.total_cost),
      ]);

      autoTable(doc, {
        startY: 54,
        head: [[
          "Muncitor",
          "Salariu",
          "Zile lucr.",
          "Normă",
          "Cost/oră",
          "Ore normale",
          "Cost normale",
          "Ore extra",
          "Cost extra",
          "Weekend",
          "Cost weekend",
          "Cost total",
        ]],
        body: workerRows,
        styles: {
          fontSize: 9,
          cellPadding: 2.5,
        },
        headStyles: {
          fillColor: [1, 150, 255],
        },
      });
    }

    const fileName = `manopera-${project.name
      .toLowerCase()
      .replace(/\s+/g, "-")}-${activeTab}-${periodMode === "tot_proiectul" ? "tot-proiectul" : selectedMonth}.pdf`;

    doc.save(fileName);
  };

  const getTabClasses = (tab: TabKey) => {
    return activeTab === tab
      ? "bg-[#0196ff] text-white"
      : "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="p-6">Se încarcă manopera...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manoperă</h1>
            <p className="text-sm text-gray-600">
              Cost real calculat din salarii, pontaje, ore extra și weekend.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-row">
            <button
              onClick={() => router.push(`/admin/centre-de-cost/${projectId}`)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
            >
              Înapoi la centrul de cost
            </button>

            <button
              onClick={handleExportPdf}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-4 shadow md:p-5">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-gray-900 md:text-lg">
                {project.name}
              </h2>
              <p className="text-sm text-gray-500">
                Cod centru de cost: {project.cost_center_code || "-"}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {project.beneficiary || "-"} • {project.project_location || "-"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 md:text-xs">
                  Perioadă
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 md:text-sm">
                  {periodLabel}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 md:text-xs">
                  {periodMode === "tot_proiectul"
                    ? "Zile lucrătoare"
                    : "Zile lucrătoare"}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 md:text-sm">
                  {displayMeta.workingDays}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 md:text-xs">
                  {periodMode === "tot_proiectul" ? "Normă proiect" : "Normă lunară"}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 md:text-sm">
                  {displayMeta.normHours} ore
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 md:text-xs">
                  Sărbători legale
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 md:text-sm">
                  {displayMeta.legalHolidays.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 md:text-xs">
                  Muncitori
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 md:text-sm">
                  {summaryCards.workersCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                showFilters
                  ? "bg-gray-500 hover:bg-gray-600"
                  : "bg-[#0196ff] hover:opacity-90"
              }`}
            >
              {showFilters ? "ASCUNDE FILTRE MANOPERĂ" : "ARATĂ FILTRE MANOPERĂ"}
            </button>
          </div>

          {showFilters && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Filtre</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Filtrează manopera după perioadă și muncitor.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Tip perioadă
                  </label>
                  <select
                    value={periodMode}
                    onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="tot_proiectul">De la inceputul proiectului</option>
                    <option value="luna">Pe lună</option>
                  </select>
                </div>

                {periodMode === "luna" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Lună
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="toate">Toți muncitorii</option>
                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("sumar")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${getTabClasses(
                  "sumar"
                )}`}
              >
                Sumar
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("detaliu")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${getTabClasses(
                  "detaliu"
                )}`}
              >
                Detaliu
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("muncitori")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${getTabClasses(
                  "muncitori"
                )}`}
              >
                Pe muncitori
              </button>
            </div>

            <p className="text-sm text-gray-500">
              La export PDF se va salva tabul selectat și perioada curentă.
            </p>
          </div>

          {activeTab === "sumar" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-white p-5 shadow">
                  <p className="text-sm font-medium text-gray-500">
                    Total manoperă
                  </p>
                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {summaryCards.totalCost.toFixed(2)} lei
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow">
                  <p className="text-sm font-medium text-gray-500">Ore normale</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {summaryCards.normalHours.toFixed(2)} h
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow">
                  <p className="text-sm font-medium text-gray-500">Ore extra</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {summaryCards.extraHours.toFixed(2)} h
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow">
                  <p className="text-sm font-medium text-gray-500">
                    Zile weekend
                  </p>
                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {summaryCards.weekendDays}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow">
                  <h2 className="text-lg font-semibold">Defalcare costuri</h2>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Cost ore normale
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summaryCards.normalCost.toFixed(2)} lei
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Cost ore extra
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summaryCards.extraCost.toFixed(2)} lei
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Cost weekend
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summaryCards.weekendCost.toFixed(2)} lei
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-[#0196ff] px-4 py-3 text-white">
                      <span className="text-sm font-semibold">
                        Total manoperă
                      </span>
                      <span className="text-sm font-bold">
                        {summaryCards.totalCost.toFixed(2)} lei
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow">
                  <h2 className="text-lg font-semibold">Indicatori rapizi</h2>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Muncitori implicați
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summaryCards.workersCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Cost mediu / oră normală
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summaryCards.averageHourlyCost.toFixed(2)} lei
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        {periodMode === "tot_proiectul"
                          ? "Zile lucrătoare proiect"
                          : "Zile lucrătoare lună"}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {displayMeta.workingDays}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        {periodMode === "tot_proiectul" ? "Normă proiect" : "Normă lunară"}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {displayMeta.normHours} ore
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        Sărbători legale
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {displayMeta.legalHolidays.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {displayMeta.legalHolidays.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">
                      {periodMode === "tot_proiectul"
                        ? "Sărbători legale prinse în proiect"
                        : "Sărbători legale din luna selectată"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Aceste zile nu sunt considerate zile lucrătoare la calcul.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {displayMeta.legalHolidays.map((holiday) => (
                      <div
                        key={`${holiday.date}-${holiday.name}`}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(holiday.date).toLocaleDateString("ro-RO")}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {holiday.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white p-5 shadow">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">
                    Top muncitori după cost
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Primii 5 muncitori cu cea mai mare manoperă pentru perioada selectată.
                  </p>
                </div>

                {topWorkers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu există date pentru filtrul selectat.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topWorkers.map((worker, index) => (
                      <div
                        key={worker.worker_id}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              #{index + 1} {worker.worker_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Ore normale: {worker.normal_hours.toFixed(2)} h •
                              Ore extra: {worker.extra_hours.toFixed(2)} h •
                              Weekend: {worker.weekend_days}
                            </p>
                          </div>

                          <div className="text-sm font-bold text-gray-900">
                            {worker.total_cost.toFixed(2)} lei
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "detaliu" && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Detaliu pe zile</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Vezi manopera zilnică, inclusiv ore extra și weekend.
                </p>
              </div>

              {dailyDetailRows.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nu există înregistrări pentru filtrul selectat.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl">
                    <thead>
                      <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-700">
                        <th className="border-b px-4 py-3">Data</th>
                        <th className="border-b px-4 py-3">Muncitor</th>
                        <th className="border-b px-4 py-3">Cost/oră</th>
                        <th className="border-b px-4 py-3">Ore normale</th>
                        <th className="border-b px-4 py-3">Ore extra</th>
                        <th className="border-b px-4 py-3">Weekend</th>
                        <th className="border-b px-4 py-3">Cost zi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyDetailRows.map((row) => (
                        <tr key={row.key} className="bg-white text-sm">
                          <td className="border-b px-4 py-3">
                            {new Date(row.work_date).toLocaleDateString("ro-RO")}
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {row.worker_name}
                              </p>
                              {row.missing_salary && (
                                <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  Salariu lipsă
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            {row.hourly_rate.toFixed(2)} lei
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.normal_hours.toFixed(2)} h</p>
                              <p className="text-xs text-gray-500">
                                {row.normal_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.extra_hours.toFixed(2)} h</p>
                              <p className="text-xs text-gray-500">
                                {row.extra_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.weekend_days}</p>
                              <p className="text-xs text-gray-500">
                                {row.weekend_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3 font-semibold text-gray-900">
                            {row.total_cost.toFixed(2)} lei
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "muncitori" && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Sumar pe muncitori</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Costul este calculat din salariul lunar raportat la norma utilizată.
                </p>
              </div>

              {workerSummaryRows.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nu există date de manoperă pentru filtrul selectat.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl">
                    <thead>
                      <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-700">
                        <th className="border-b px-4 py-3">Muncitor</th>
                        <th className="border-b px-4 py-3">Salariu</th>
                        <th className="border-b px-4 py-3">Zile lucr.</th>
                        <th className="border-b px-4 py-3">Norma</th>
                        <th className="border-b px-4 py-3">Cost/ora</th>
                        <th className="border-b px-4 py-3">Ore normale</th>
                        <th className="border-b px-4 py-3">Ore extra</th>
                        <th className="border-b px-4 py-3">Weekend</th>
                        <th className="border-b px-4 py-3">Cost total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerSummaryRows.map((row) => (
                        <tr key={row.worker_id} className="bg-white text-sm">
                          <td className="border-b px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {row.worker_name}
                              </p>
                              {row.missing_salary && (
                                <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  Salariu lipsă
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            {row.monthly_salary > 0
                              ? `${row.monthly_salary.toFixed(2)} lei`
                              : "-"}
                          </td>
                          <td className="border-b px-4 py-3">
                            {row.working_days_in_month}
                          </td>
                          <td className="border-b px-4 py-3">
                            {row.month_norm_hours} h
                          </td>
                          <td className="border-b px-4 py-3">
                            {row.hourly_rate.toFixed(2)} lei
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.normal_hours.toFixed(2)} h</p>
                              <p className="text-xs text-gray-500">
                                {row.normal_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.extra_hours.toFixed(2)} h</p>
                              <p className="text-xs text-gray-500">
                                {row.extra_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3">
                            <div>
                              <p>{row.weekend_days}</p>
                              <p className="text-xs text-gray-500">
                                {row.weekend_cost.toFixed(2)} lei
                              </p>
                            </div>
                          </td>
                          <td className="border-b px-4 py-3 font-semibold text-gray-900">
                            {row.total_cost.toFixed(2)} lei
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}