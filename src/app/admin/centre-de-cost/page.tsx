"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getRomanianLegalHolidays } from "@/lib/romanian-working-days";

type CostCenter = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  status: string;
  cost_center_code: string | null;
  is_cost_center: boolean;
};

type Worker = {
  id: string;
  full_name: string;
  monthly_salary: number | null;
  is_active: boolean;
};

type TimeEntry = {
  id: string;
  project_id: string;
  worker_id: string;
  start_time: string;
  end_time: string | null;
  work_date: string;
  status: string;
};

type ExtraWork = {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  extra_hours: number | null;
  extra_hours_value: number | null;
  weekend_days_count: number | null;
  weekend_value: number | null;
  total_value: number | null;
};

type ApprovedOrder = {
  id: string;
  project_id: string;
  total_with_vat: number | null;
  status: string;
};

type FiscalReceipt = {
  id: string;
  project_id: string;
  total_with_vat: number | null;
};

type ProjectInvoice = {
  id: string;
  project_id: string;
  total_with_vat: number | null;
};

type NondeductibleExpense = {
  id: string;
  project_id: string;
  cost_ron: number | null;
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

type FilterKey = "toate" | "in_asteptare" | "in_lucru" | "finalizat";

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

export default function CentreDeCostPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [centres, setCentres] = useState<CostCenter[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("toate");
  const [projectTotals, setProjectTotals] = useState<Record<string, number>>({});

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
    const loadCentres = async () => {
      setLoading(true);

      const { data: centresData, error: centresError } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          beneficiary,
          project_location,
          status,
          cost_center_code,
          is_cost_center
        `)
        .eq("is_cost_center", true)
        .order("created_at", { ascending: false });

      if (centresError || !centresData) {
        setCentres([]);
        setProjectTotals({});
        setLoading(false);
        return;
      }

      const centresRows = centresData as CostCenter[];
      setCentres(centresRows);

      const projectIds = centresRows.map((item) => item.id);

      if (projectIds.length === 0) {
        setProjectTotals({});
        setLoading(false);
        return;
      }

      const [
        { data: ordersData },
        { data: receiptsData },
        { data: invoicesData },
        { data: nondeductiblesData },
        { data: workersData },
        { data: timeEntriesData },
        { data: extraWorkData },
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id, project_id, total_with_vat, status")
          .in("project_id", projectIds)
          .eq("status", "aprobata"),
        supabase
          .from("fiscal_receipts")
          .select("id, project_id, total_with_vat")
          .in("project_id", projectIds),
        supabase
          .from("project_invoices")
          .select("id, project_id, total_with_vat")
          .in("project_id", projectIds),
        supabase
          .from("project_nondeductible_expenses")
          .select("id, project_id, cost_ron")
          .in("project_id", projectIds),
        supabase
          .from("workers")
          .select("id, full_name, monthly_salary, is_active")
          .eq("is_active", true),
        supabase
          .from("time_entries")
          .select("id, project_id, worker_id, start_time, end_time, work_date, status")
          .in("project_id", projectIds)
          .not("end_time", "is", null),
        supabase
          .from("extra_work")
          .select("id, project_id, worker_id, work_date, extra_hours, extra_hours_value, weekend_days_count, weekend_value, total_value")
          .in("project_id", projectIds),
      ]);

      const orders = (ordersData || []) as ApprovedOrder[];
      const receipts = (receiptsData || []) as FiscalReceipt[];
      const invoices = (invoicesData || []) as ProjectInvoice[];
      const nondeductibles = (nondeductiblesData || []) as NondeductibleExpense[];
      const workers = (workersData || []) as Worker[];
      const timeEntries = (timeEntriesData || []) as TimeEntry[];
      const extraWorkRows = (extraWorkData || []) as ExtraWork[];

      const workerMap = new Map<string, Worker>();
      workers.forEach((worker) => {
        workerMap.set(worker.id, worker);
      });

      const totalsMap: Record<string, number> = {};

      projectIds.forEach((projectId) => {
        const projectOrdersTotal = orders
          .filter((item) => item.project_id === projectId)
          .reduce((sum, item) => sum + Number(item.total_with_vat || 0), 0);

        const projectReceiptsTotal = receipts
          .filter((item) => item.project_id === projectId)
          .reduce((sum, item) => sum + Number(item.total_with_vat || 0), 0);

        const projectInvoicesTotal = invoices
          .filter((item) => item.project_id === projectId)
          .reduce((sum, item) => sum + Number(item.total_with_vat || 0), 0);

        const projectNondeductiblesTotal = nondeductibles
          .filter((item) => item.project_id === projectId)
          .reduce((sum, item) => sum + Number(item.cost_ron || 0), 0);

        const projectTimeEntries = timeEntries.filter(
          (item) => item.project_id === projectId
        );
        const projectExtraWork = extraWorkRows.filter(
          (item) => item.project_id === projectId
        );

        const allProjectDates = [
          ...projectTimeEntries.map((entry) => entry.work_date),
          ...projectExtraWork.map((row) => row.work_date),
        ]
          .filter(Boolean)
          .sort();

        let projectManoperaTotal = 0;

        if (allProjectDates.length > 0) {
          const startDate = new Date(`${allProjectDates[0]}T00:00:00`);
          const endDate = new Date(
            `${allProjectDates[allProjectDates.length - 1]}T00:00:00`
          );

          const meta = getWorkingDaysAndHolidaysInRangeRomania(startDate, endDate);

          const hourlyRateMap = new Map<string, number>();

          workers.forEach((worker) => {
            const monthlySalary = Number(worker.monthly_salary || 0);
            const hourlyRate = meta.normHours > 0 ? monthlySalary / meta.normHours : 0;
            hourlyRateMap.set(worker.id, hourlyRate);
          });

          const normalCost = projectTimeEntries.reduce((sum, entry) => {
            if (!entry.end_time) return sum;

            const workedMs = getWorkedMsWithoutPause(entry.start_time, entry.end_time);
            const workedHours = workedMs / (1000 * 60 * 60);
            const hourlyRate = Number(hourlyRateMap.get(entry.worker_id) || 0);

            return sum + workedHours * hourlyRate;
          }, 0);

          const extraCost = projectExtraWork.reduce((sum, row) => {
            return (
              sum +
              Number(row.extra_hours_value || 0) +
              Number(row.weekend_value || 0)
            );
          }, 0);

          projectManoperaTotal = normalCost + extraCost;
        }

        totalsMap[projectId] =
          projectOrdersTotal +
          projectReceiptsTotal +
          projectInvoicesTotal +
          projectNondeductiblesTotal +
          projectManoperaTotal;
      });

      setProjectTotals(totalsMap);
      setLoading(false);
    };

    loadCentres();
  }, []);

  const stats = useMemo(() => {
    return {
      total: centres.length,
      inAsteptare: centres.filter((item) => item.status === "in_asteptare").length,
      inLucru: centres.filter((item) => item.status === "in_lucru").length,
      finalizate: centres.filter((item) => item.status === "finalizat").length,
    };
  }, [centres]);

  const filteredCentres = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return centres.filter((centre) => {
      const matchesFilter =
        activeFilter === "toate" ? true : centre.status === activeFilter;

      const haystack = [
        centre.name || "",
        centre.beneficiary || "",
        centre.cost_center_code || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = normalized.length === 0 ? true : haystack.includes(normalized);

      return matchesFilter && matchesSearch;
    });
  }, [centres, activeFilter, searchTerm]);

  const getStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getStatusStyle = (status: string) => {
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

  const getFilterCardClasses = (filter: FilterKey) => {
    const active = activeFilter === filter;

    if (filter === "toate") {
      return active
        ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
        : "border-transparent bg-blue-50";
    }

    if (filter === "in_asteptare") {
      return active
        ? "border-sky-400 ring-2 ring-sky-200 bg-sky-50"
        : "border-transparent bg-sky-50";
    }

    if (filter === "in_lucru") {
      return active
        ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50"
        : "border-transparent bg-amber-50";
    }

    return active
      ? "border-green-400 ring-2 ring-green-200 bg-green-50"
      : "border-transparent bg-green-50";
  };

  const renderCenterIcon = () => {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
        <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="10" width="7" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  };

if (loading) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
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
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă datele...</p>
            <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
          </div>
        </div>
      </div>
    </div>
  );
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
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la panou admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Modul administrativ</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Centre de cost
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Toate proiectele marcate ca centre de cost.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveFilter("toate")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses(
                "toate"
              )}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">
                {stats.total}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                Total
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("in_asteptare")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses(
                "in_asteptare"
              )}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-sky-600 sm:text-3xl">
                {stats.inAsteptare}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                În așteptare
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("in_lucru")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses(
                "in_lucru"
              )}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-amber-600 sm:text-3xl">
                {stats.inLucru}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                În lucru
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("finalizat")}
              className={`rounded-2xl border px-3 py-3 text-center transition ${getFilterCardClasses(
                "finalizat"
              )}`}
            >
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">
                {stats.finalizate}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">
                Finalizate
              </p>
            </button>
          </div>

          <div className="mt-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Caută după nume proiect, beneficiar sau cod CC..."
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista centrelor de cost
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredCentres.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există centre de cost pentru filtrul selectat.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-2">Cod proiect</div>
                  <div className="col-span-3">Proiect</div>
                  <div className="col-span-2">Beneficiar</div>
                  <div className="col-span-2">Locație</div>
                  <div className="col-span-2">Total centru cost</div>
                  <div className="col-span-1">Status</div>
                </div>

                {filteredCentres.map((centre) => (
                  <button
                    key={centre.id}
                    type="button"
                    onClick={() => router.push(`/admin/centre-de-cost/${centre.id}`)}
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-2 text-sm font-semibold text-gray-900">
                      {centre.cost_center_code || "-"}
                    </div>

                    <div className="col-span-3 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                        {renderCenterIcon()}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {centre.name}
                      </p>
                    </div>

                    <div className="col-span-2 text-sm text-gray-500">
                      {centre.beneficiary || "-"}
                    </div>

                    <div className="col-span-2 text-sm text-gray-500">
                      {centre.project_location || "-"}
                    </div>

                    <div className="col-span-2 text-sm font-bold text-gray-900">
                      {Number(projectTotals[centre.id] || 0).toFixed(2)} lei
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                          centre.status
                        )}`}
                      >
                        {getStatusLabel(centre.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredCentres.map((centre) => (
                  <button
                    key={centre.id}
                    type="button"
                    onClick={() => router.push(`/admin/centre-de-cost/${centre.id}`)}
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderCenterIcon()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-lg">
                              {centre.name}
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-400">
                              {centre.cost_center_code || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                          centre.status
                        )}`}
                      >
                        {getStatusLabel(centre.status)}
                      </span>
                    </div>

                    <div className="mt-4 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Beneficiar
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {centre.beneficiary || "-"}
                      </p>
                    </div>

                    <div className="mt-3 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Locație
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {centre.project_location || "-"}
                      </p>
                    </div>

                    <div className="mt-3 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Total centru de cost
                      </p>
                      <p className="mt-1 text-base font-bold text-gray-900">
                        {Number(projectTotals[centre.id] || 0).toFixed(2)} lei
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