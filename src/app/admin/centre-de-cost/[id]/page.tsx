"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getRomanianLegalHolidays } from "@/lib/romanian-working-days";

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

type FiscalReceipt = {
  id: string;
  receipt_date: string;
  supplier: string | null;
  document_number: string | null;
  total_without_vat: number | null;
  total_with_vat: number | null;
  created_at: string;
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

type HolidayInfo = {
  date: string;
  name: string;
};

type DisplayMeta = {
  workingDays: number;
  normHours: number;
  legalHolidays: HolidayInfo[];
};

type ManoperaSummary = {
  normalHours: number;
  normalCost: number;
  extraHours: number;
  extraCost: number;
  weekendDays: number;
  weekendCost: number;
  totalCost: number;
  workersCount: number;
  workingDays: number;
  normHours: number;
  legalHolidaysCount: number;
};

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

export default function CentruDeCostDetaliuPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [extraWorkRows, setExtraWorkRows] = useState<ExtraWork[]>([]);

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
    const endMs = endTime ? new Date(endTime).getTime() : startMs;

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

      const { data: ordersData } = await supabase
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

      const { data: receiptsData } = await supabase
        .from("fiscal_receipts")
        .select(`
          id,
          receipt_date,
          supplier,
          document_number,
          total_without_vat,
          total_with_vat,
          created_at
        `)
        .eq("project_id", projectId)
        .order("receipt_date", { ascending: false })
        .order("created_at", { ascending: false });

      const { data: workersData } = await supabase
        .from("workers")
        .select("id, full_name, monthly_salary, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      const { data: timeEntriesData } = await supabase
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

      const { data: extraWorkData } = await supabase
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

      setProject(projectData as ProjectDetails);
      setOrders((ordersData as ApprovedOrder[]) || []);
      setReceipts((receiptsData as FiscalReceipt[]) || []);
      setWorkers((workersData as Worker[]) || []);
      setTimeEntries((timeEntriesData as TimeEntry[]) || []);
      setExtraWorkRows((extraWorkData as ExtraWork[]) || []);
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

  const receiptTotals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        acc.count += 1;
        acc.total += Number(receipt.total_with_vat || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [receipts]);

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

  const manoperaSummary = useMemo<ManoperaSummary>(() => {
    const workerSalaryMap = new Map<
      string,
      { monthlySalary: number; hourlyRate: number }
    >();

    workers.forEach((worker) => {
      const monthlySalary = Number(worker.monthly_salary || 0);
      const hourlyRate =
        projectMeta.normHours > 0 ? monthlySalary / projectMeta.normHours : 0;

      workerSalaryMap.set(worker.id, {
        monthlySalary,
        hourlyRate,
      });
    });

    let normalHours = 0;
    let normalCost = 0;
    const involvedWorkers = new Set<string>();

    timeEntries.forEach((entry) => {
      if (!entry.end_time) return;

      const workedMs = getWorkedMsWithoutPause(entry.start_time, entry.end_time);
      const workedHours = workedMs / (1000 * 60 * 60);

      if (workedHours <= 0) return;

      const salaryInfo = workerSalaryMap.get(entry.worker_id);
      const hourlyRate = Number(salaryInfo?.hourlyRate || 0);

      normalHours += workedHours;
      normalCost += workedHours * hourlyRate;
      involvedWorkers.add(entry.worker_id);
    });

    let extraHours = 0;
    let extraCost = 0;
    let weekendDays = 0;
    let weekendCost = 0;

    extraWorkRows.forEach((row) => {
      const rowExtraHours = Number(row.extra_hours || 0);
      const rowExtraCost = Number(row.extra_hours_value || 0);
      const rowWeekendDays = Number(row.weekend_days_count || 0);
      const rowWeekendCost = Number(row.weekend_value || 0);

      extraHours += rowExtraHours;
      extraCost += rowExtraCost;
      weekendDays += rowWeekendDays;
      weekendCost += rowWeekendCost;

      if (
        rowExtraHours > 0 ||
        rowExtraCost > 0 ||
        rowWeekendDays > 0 ||
        rowWeekendCost > 0
      ) {
        involvedWorkers.add(row.worker_id);
      }
    });

    return {
      normalHours,
      normalCost,
      extraHours,
      extraCost,
      weekendDays,
      weekendCost,
      totalCost: normalCost + extraCost + weekendCost,
      workersCount: involvedWorkers.size,
      workingDays: projectMeta.workingDays,
      normHours: projectMeta.normHours,
      legalHolidaysCount: projectMeta.legalHolidays.length,
    };
  }, [workers, timeEntries, extraWorkRows, projectMeta]);

  const categoryTotals = useMemo(() => {
    return {
      comenzi: orderTotals.total,
      bonuri: receiptTotals.total,
      facturi: 0,
      transport: 0,
      manopera: manoperaSummary.totalCost,
      nedeductibile: 0,
    };
  }, [orderTotals, receiptTotals, manoperaSummary]);

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
      details: [] as string[],
    },
    {
      key: "bonuri",
      title: "Bonuri",
      value: categoryTotals.bonuri,
      description: "Bonuri fiscale aferente proiectului",
      active: true,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
      details: [`Total bonuri: ${receiptTotals.count}`] as string[],
    },
    {
      key: "facturi",
      title: "Facturi",
      value: categoryTotals.facturi,
      description: "Facturi aferente proiectului",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
      details: [] as string[],
    },
    {
      key: "transport",
      title: "Transport",
      value: categoryTotals.transport,
      description: "Cheltuieli de transport",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
      details: [] as string[],
    },
    {
      key: "manopera",
      title: "Manoperă",
      value: categoryTotals.manopera,
      description: "Costuri reale din ore lucrate, extra și weekend",
      active: true,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
      details: [
        `Ore normale: ${manoperaSummary.normalHours.toFixed(2)} h`,
        `Ore extra: ${manoperaSummary.extraHours.toFixed(2)} h`,
        `Zile weekend: ${manoperaSummary.weekendDays}`,
        `Muncitori implicați: ${manoperaSummary.workersCount}`,
      ],
    },
    {
      key: "nedeductibile",
      title: "Nedeductibile",
      value: categoryTotals.nedeductibile,
      description: "Cheltuieli nedeductibile",
      active: false,
      color: "bg-white text-gray-900",
      subColor: "text-gray-500",
      details: [] as string[],
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
                <p className="text-xs font-medium text-gray-500">
                  Termen execuție
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {project.execution_deadline
                    ? new Date(project.execution_deadline).toLocaleDateString(
                        "ro-RO"
                      )
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

                      {card.details.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {card.details.map((detail) => (
                            <p
                              key={detail}
                              className={`text-xs font-medium ${card.subColor}`}
                            >
                              {detail}
                            </p>
                          ))}
                        </div>
                      )}

                      <p className={`mt-3 text-xs ${card.subColor}`}>
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
                  {projectGrandTotal.toFixed(2)} lei
                </p>
                <p className="mt-2 text-xl font-bold">(TVA Inclus)</p>
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