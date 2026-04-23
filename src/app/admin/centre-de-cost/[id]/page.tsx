"use client";

import Image from "next/image";
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
  budget_ron: number | null;
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

type ProjectInvoice = {
  id: string;
  invoice_date: string;
  supplier: string | null;
  document_number: string | null;
  total_without_vat: number | null;
  total_with_vat: number | null;
  created_at: string;
};

type NondeductibleExpense = {
  id: string;
  expense_date: string;
  service_name: string | null;
  cost_ron: number | null;
  notes: string | null;
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
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [nondeductibles, setNondeductibles] = useState<NondeductibleExpense[]>([]);
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
          is_cost_center,
          budget_ron
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

      const { data: invoicesData } = await supabase
        .from("project_invoices")
        .select(`
          id,
          invoice_date,
          supplier,
          document_number,
          total_without_vat,
          total_with_vat,
          created_at
        `)
        .eq("project_id", projectId)
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false });

      const { data: nondeductiblesData } = await supabase
        .from("project_nondeductible_expenses")
        .select(`
          id,
          expense_date,
          service_name,
          cost_ron,
          notes,
          created_at
        `)
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false })
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
      setInvoices((invoicesData as ProjectInvoice[]) || []);
      setNondeductibles((nondeductiblesData as NondeductibleExpense[]) || []);
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

  const invoiceTotals = useMemo(() => {
    return invoices.reduce(
      (acc, invoice) => {
        acc.count += 1;
        acc.total += Number(invoice.total_with_vat || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [invoices]);

  const nondeductibleTotals = useMemo(() => {
    return nondeductibles.reduce(
      (acc, item) => {
        acc.count += 1;
        acc.total += Number(item.cost_ron || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [nondeductibles]);

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
      facturi: invoiceTotals.total,
      transport: 0,
      manopera: manoperaSummary.totalCost,
      nedeductibile: nondeductibleTotals.total,
    };
  }, [orderTotals, receiptTotals, invoiceTotals, manoperaSummary, nondeductibleTotals]);

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

  const remainingBudget = useMemo(() => {
    return Number(project?.budget_ron || 0) - projectGrandTotal;
  }, [project?.budget_ron, projectGrandTotal]);

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getProjectStatusStyle = (status: string) => {
    if (status === "in_asteptare") return "bg-blue-100 text-blue-800";
    if (status === "in_lucru") return "bg-yellow-100 text-yellow-800";
    if (status === "finalizat") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  const handleCategoryClick = (key: string) => {
    if (key === "comenzi") return router.push(`/admin/centre-de-cost/${projectId}/comenzi`);
    if (key === "bonuri") return router.push(`/admin/centre-de-cost/${projectId}/bonuri`);
    if (key === "facturi") return router.push(`/admin/centre-de-cost/${projectId}/facturi`);
    if (key === "transport") return router.push(`/admin/centre-de-cost/${projectId}/transport`);
    if (key === "manopera") return router.push(`/admin/centre-de-cost/${projectId}/manopera`);
    if (key === "nedeductibile") return router.push(`/admin/centre-de-cost/${projectId}/nedeductibile`);
  };

  const renderProjectIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="10" width="7" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );

  const renderCategoryIcon = (key: string) => {
    const iconClass = "h-6 w-6 text-blue-600 sm:h-7 sm:w-7";

    if (key === "comenzi") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M4 6h2l1.4 6.5h8.8L18 8H8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="18" r="1.5" fill="currentColor" />
          <circle cx="17" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    }

    if (key === "bonuri") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M7 5h10l2 2v12H7V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 10h5M10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    if (key === "facturi") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    if (key === "transport") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M5 16v2M19 16v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="17" r="1.5" fill="currentColor" />
          <circle cx="16" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    }

    if (key === "manopera") {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
          <path d="M4 18c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 18c.2-1.8 1.8-3.2 4-3.2 1.1 0 2.1.3 2.9.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
        <path d="M7 5h10l2 2v12H7V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 10h6M10 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  };

  const categoryCards = [
    {
      key: "comenzi",
      title: "Comenzi",
      value: categoryTotals.comenzi,
      description: "Comenzi aprobate din proiect",
      active: true,
      details: [] as string[],
    },
    {
      key: "bonuri",
      title: "Bonuri",
      value: categoryTotals.bonuri,
      description: "Bonuri fiscale aferente proiectului",
      active: true,
      details: [`Total bonuri: ${receiptTotals.count}`] as string[],
    },
    {
      key: "facturi",
      title: "Facturi",
      value: categoryTotals.facturi,
      description: "Facturi aferente proiectului",
      active: true,
      details: [`Total facturi: ${invoiceTotals.count}`] as string[],
    },
    {
      key: "transport",
      title: "Transport",
      value: categoryTotals.transport,
      description: "Cheltuieli de transport",
      active: false,
      details: [] as string[],
    },
    {
      key: "manopera",
      title: "Manoperă",
      value: categoryTotals.manopera,
      description: "Costuri reale din ore lucrate, extra și weekend",
      active: true,
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
      active: true,
      details: [`Total înregistrări: ${nondeductibleTotals.count}`] as string[],
    },
  ];

if (loading) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-blue-600">
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          <div className="text-center">
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă centrul de cost...</p>
            <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            onClick={() => router.push("/admin/centre-de-cost")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la centre de cost
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                  {renderProjectIcon()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Detaliu centru de cost</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {project.name}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-gray-400">
                    Cod centru de cost: {project.cost_center_code || "-"}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm text-gray-500 sm:text-base">
                Vezi structura costurilor pe proiect, bugetul disponibil și fiecare
                categorie de cheltuială.
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

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Beneficiar
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.beneficiary || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Locație
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.project_location || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Tip proiect
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.project_type || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Grupă
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.project_group || "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Data început
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Termen execuție
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.execution_deadline
                  ? new Date(project.execution_deadline).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Buget
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {project.budget_ron !== null && project.budget_ron !== undefined
                  ? `${Number(project.budget_ron).toFixed(2)} lei`
                  : "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Buget proiect</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {Number(project.budget_ron || 0).toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Total cheltuit</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {projectGrandTotal.toFixed(2)} lei
              </p>
            </div>

            <div
              className={`rounded-[22px] p-4 shadow-sm ${
                remainingBudget >= 0
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              <p className="text-sm text-white/80">Diferență rămasă</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {remainingBudget.toFixed(2)} lei
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Categorii centru de cost
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => handleCategoryClick(card.key)}
                className="relative min-h-[180px] overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[190px] sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                    {renderCategoryIcon(card.key)}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-lg sm:leading-6">
                      {card.title}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400 sm:text-sm">
                      {card.description}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
                  {card.value.toFixed(2)} lei
                </p>

                {card.details.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {card.details.map((detail) => (
                      <p key={detail} className="text-[11px] text-gray-500 sm:text-xs">
                        {detail}
                      </p>
                    ))}
                  </div>
                )}

                <p className="mt-4 pr-12 text-[11px] font-medium text-gray-400">
                  {card.active ? "Funcție activă" : "În dezvoltare"}
                </p>

                <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#F0EEE9] text-sm text-gray-400 sm:h-8 sm:w-8 sm:text-base">
                  ›
                </div>
              </button>
            ))}

            <div className="rounded-[22px] bg-[#0196ff] p-4 text-white shadow-sm sm:p-5">
              <h3 className="text-lg font-semibold">Total general proiect</h3>
              <p className="mt-1 text-sm text-white/80">
                Total cumulat din toate categoriile
              </p>
              <p className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {projectGrandTotal.toFixed(2)} lei
              </p>
              <p className="mt-2 text-lg font-bold">(TVA Inclus)</p>
              <p className="mt-2 text-xs text-white/80">
                Sumar total centru de cost
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}