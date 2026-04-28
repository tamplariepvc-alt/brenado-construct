"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BottomNav from "@/components/BottomNav";

type ExtraWorkRow = {
  id: string; project_id: string; worker_id: string; work_date: string;
  extra_hours: number; is_saturday: boolean; is_sunday: boolean;
  extra_hours_paid: boolean; weekend_paid: boolean;
  extra_hours_value: number; weekend_days_count: number;
  weekend_value: number; total_value: number; created_at: string;
};
type WorkerOption = { id: string; full_name: string };
type ProjectOption = { id: string; name: string };
type CategoryType = "extra" | "weekend";
type PeriodFilterType = "doua_saptamani" | "zi" | "interval" | "toate";
type PaymentFilterType = "toate" | "achitate" | "neachitate";

export default function OreExtraWeekendPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExtraWorkRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  const [category, setCategory] = useState<CategoryType>("extra");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterType>("toate");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>("doua_saptamani");
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
    return { start, end, startStr: start.toISOString().split("T")[0], endStr: end.toISOString().split("T")[0] };
  };

  useEffect(() => {
    const { startStr, endStr } = getTwoWeeksRange();
    setStartDate(startStr);
    setEndDate(endStr);
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Access check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile) { router.push("/login"); return; }
    const allowedRoles = ["administrator", "cont_tehnic", "admin_limitat"];
    if (!allowedRoles.includes(profile.role)) { router.push("/dashboard"); return; }
    setUserRole(profile.role);

    const { data: extraData, error: extraError } = await supabase
      .from("extra_work")
      .select("id, project_id, worker_id, work_date, extra_hours, is_saturday, is_sunday, extra_hours_paid, weekend_paid, extra_hours_value, weekend_days_count, weekend_value, total_value, created_at")
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: workersData } = await supabase.from("workers").select("id, full_name").order("full_name", { ascending: true });
    const { data: projectsData } = await supabase.from("projects").select("id, name").order("name", { ascending: true });

    if (!extraError && extraData) setRows(extraData as ExtraWorkRow[]);
    else setRows([]);

    setWorkers((workersData || []) as WorkerOption[]);
    setProjects((projectsData || []) as ProjectOption[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w.full_name])), [workers]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const getWorkerName = (row: ExtraWorkRow) => workerMap.get(row.worker_id) || "-";
  const getProjectName = (row: ExtraWorkRow) => projectMap.get(row.project_id) || "-";

  const filteredRows = useMemo(() => {
    const { start, end } = getTwoWeeksRange();
    return rows.filter((row) => {
      const rowDate = new Date(`${row.work_date}T00:00:00`);
      const workerName = getWorkerName(row).toLowerCase();
      const projectName = getProjectName(row).toLowerCase();
      const isPaid = category === "extra" ? row.extra_hours_paid : row.weekend_paid;
      const isExtra = Number(row.extra_hours || 0) > 0 || Number(row.extra_hours_value || 0) > 0;
      const isWeekend = Boolean(row.is_saturday) || Boolean(row.is_sunday) || Number(row.weekend_days_count || 0) > 0 || Number(row.weekend_value || 0) > 0;
      if (category === "extra" && !isExtra) return false;
      if (category === "weekend" && !isWeekend) return false;
      if (paymentFilter === "achitate" && !isPaid) return false;
      if (paymentFilter === "neachitate" && isPaid) return false;
      if (periodFilter === "doua_saptamani") { if (rowDate < start || rowDate > end) return false; }
      if (periodFilter === "zi" && selectedDay) { if (row.work_date !== selectedDay) return false; }
      if (periodFilter === "interval" && startDate && endDate) {
        const s = new Date(`${startDate}T00:00:00`); const e = new Date(`${endDate}T23:59:59`);
        if (rowDate < s || rowDate > e) return false;
      }
      if (selectedProjectId !== "placeholder" && selectedProjectId !== "all" && row.project_id !== selectedProjectId) return false;
      if (workerSearch.trim() && !workerName.includes(workerSearch.trim().toLowerCase())) return false;
      if (projectSearch.trim() && !projectName.includes(projectSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, category, paymentFilter, periodFilter, selectedDay, startDate, endDate, workerSearch, projectSearch, selectedProjectId, workerMap, projectMap]);

  const totals = useMemo(() => filteredRows.reduce(
    (acc, row) => {
      acc.extraHours += Number(row.extra_hours || 0);
      acc.extraValue += Number(row.extra_hours_value || 0);
      acc.weekendDays += Number(row.weekend_days_count || 0);
      acc.weekendValue += Number(row.weekend_value || 0);
      acc.total += Number(row.total_value || 0);
      return acc;
    },
    { extraHours: 0, extraValue: 0, weekendDays: 0, weekendValue: 0, total: 0 }
  ), [filteredRows]);

  const handleMarkExtraPaid = async (row: ExtraWorkRow) => {
    setProcessingId(row.id);
    const { error } = await supabase.from("extra_work").update({ extra_hours_paid: true }).eq("id", row.id);
    if (error) { alert("A apărut o eroare la achitarea orelor."); setProcessingId(null); return; }
    setProcessingId(null);
    await loadData();
  };

  const handleMarkWeekendPaid = async (row: ExtraWorkRow) => {
    setProcessingId(row.id);
    const { error } = await supabase.from("extra_work").update({ weekend_paid: true }).eq("id", row.id);
    if (error) { alert("A apărut o eroare la achitarea zilelor de weekend."); setProcessingId(null); return; }
    setProcessingId(null);
    await loadData();
  };

  const exportPdf = () => {
    if (filteredRows.length === 0) { alert("Nu există date pentru export."); return; }
    const doc = new jsPDF("p", "mm", "a4");
    const now = new Date();
    const title = category === "extra" ? "Raport Ore Extra" : "Raport Zile Weekend";
    const periodLabel = periodFilter === "doua_saptamani" ? "Ultimele 2 saptamani" : periodFilter === "zi" ? `Zi selectata: ${selectedDay || "-"}` : periodFilter === "interval" ? `Interval: ${startDate || "-"} - ${endDate || "-"}` : "Toate";
    const selectedProjectLabel = selectedProjectId === "placeholder" ? "Alege santier" : selectedProjectId === "all" ? "Toate santierele" : projectMap.get(selectedProjectId) || "-";
    const paymentLabel = paymentFilter === "toate" ? "Toate" : paymentFilter === "achitate" ? "Achitate" : "Neachitate";
    doc.setFontSize(15); doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Export: ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`, 14, 21);
    doc.text(`Status plata: ${paymentLabel}`, 14, 26);
    doc.text(`Perioada: ${periodLabel}`, 14, 31);
    doc.text(`Santier selectat: ${selectedProjectLabel}`, 14, 36);
    doc.text(`Nume: ${workerSearch || "-"}`, 14, 41);
    doc.text(`Cautare santier: ${projectSearch || "-"}`, 14, 46);
    if (category === "extra") {
      doc.text(`Total valoare ore extra: ${totals.extraValue.toFixed(2)} lei`, 14, 51);
      autoTable(doc, { startY: 56, head: [["Nume", "Santier", "Data", "Ore", "Valoare", "Status"]], body: filteredRows.map((row) => [getWorkerName(row), getProjectName(row), new Date(row.work_date).toLocaleDateString("ro-RO"), Number(row.extra_hours || 0).toFixed(2), `${Number(row.extra_hours_value || 0).toFixed(2)} lei`, row.extra_hours_paid ? "Achitat" : "Neachitat"]), styles: { fontSize: 8, cellPadding: 2.2 }, headStyles: { fillColor: [147, 51, 234] }, theme: "grid" });
    } else {
      doc.text(`Total valoare weekend: ${totals.weekendValue.toFixed(2)} lei`, 14, 51);
      autoTable(doc, { startY: 56, head: [["Nume", "Santier", "Data", "Sambata", "Duminica", "Zile", "Valoare", "Status"]], body: filteredRows.map((row) => [getWorkerName(row), getProjectName(row), new Date(row.work_date).toLocaleDateString("ro-RO"), row.is_saturday ? "Da" : "Nu", row.is_sunday ? "Da" : "Nu", Number(row.weekend_days_count || 0).toFixed(0), `${Number(row.weekend_value || 0).toFixed(2)} lei`, row.weekend_paid ? "Achitat" : "Neachitat"]), styles: { fontSize: 8, cellPadding: 2.2 }, headStyles: { fillColor: [234, 88, 12] }, theme: "grid" });
    }
    doc.save(category === "extra" ? "raport_ore_extra.pdf" : "raport_zile_weekend.pdf");
  };

  const activeTotal = category === "extra" ? totals.extraValue : totals.weekendValue;

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderIcon()}</div>
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
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">{renderIcon()}</div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Ore extra & Weekend</h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">Vizualizează și gestionează orele suplimentare și zilele de weekend lucrate.</p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setCategory("extra")}
              className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${category === "extra" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              Ore extra
            </button>
            <button type="button" onClick={() => setCategory("weekend")}
              className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${category === "weekend" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              Weekend
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`rounded-[20px] p-4 shadow-sm ${category === "extra" ? "bg-purple-600" : "bg-orange-500"}`}>
            <p className="text-xs font-semibold text-white/80">{category === "extra" ? "Total ore" : "Total zile"}</p>
            <p className="mt-1 text-2xl font-extrabold text-white">{category === "extra" ? `${totals.extraHours.toFixed(1)} h` : `${totals.weekendDays} zile`}</p>
          </div>
          <div className={`rounded-[20px] p-4 shadow-sm ${category === "extra" ? "bg-purple-600" : "bg-orange-500"}`}>
            <p className="text-xs font-semibold text-white/80">Valoare totală</p>
            <p className="mt-1 text-2xl font-extrabold text-white">{activeTotal.toFixed(2)} lei</p>
          </div>
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400">Înregistrări</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{filteredRows.length}</p>
          </div>
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400">Neachitate</p>
            <p className="mt-1 text-2xl font-extrabold text-red-600">
              {filteredRows.filter((r) => category === "extra" ? !r.extra_hours_paid : !r.weekend_paid).length}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Filtre</h2>
            <button type="button" onClick={exportPdf}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              Export PDF
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Status plată</label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilterType)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500">
                <option value="toate">Toate</option>
                <option value="achitate">Achitate</option>
                <option value="neachitate">Neachitate</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Perioadă</label>
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterType)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500">
                <option value="doua_saptamani">Ultimele 2 săptămâni</option>
                <option value="zi">Caută după zi</option>
                <option value="interval">După perioadă</option>
                <option value="toate">Toate</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Șantier</label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500">
                <option value="placeholder">Alege șantier</option>
                <option value="all">Toate șantierele</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Caută după nume</label>
              <input type="text" value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder="Ex: Ionel"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Caută după șantier</label>
              <input type="text" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Ex: Amenajări"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
            </div>
            {periodFilter === "zi" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Selectează ziua</label>
                <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
              </div>
            )}
            {periodFilter === "interval" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">De la</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Până la</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {category === "extra" ? "Ore extra" : "Zile weekend"} — {filteredRows.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredRows.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Nu există înregistrări pentru filtrele selectate.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => {
                const isPaid = category === "extra" ? row.extra_hours_paid : row.weekend_paid;
                const isProcessing = processingId === row.id;
                return (
                  <div key={row.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{getWorkerName(row)}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{getProjectName(row)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          {new Date(row.work_date).toLocaleDateString("ro-RO")}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {isPaid ? "Achitat" : "Neachitat"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {category === "extra" ? (
                        <>
                          <div className="rounded-2xl bg-purple-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-purple-600">Ore extra</p>
                            <p className="mt-0.5 text-lg font-bold text-purple-800">{Number(row.extra_hours || 0).toFixed(1)} h</p>
                          </div>
                          <div className="rounded-2xl bg-purple-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-purple-600">Valoare</p>
                            <p className="mt-0.5 text-lg font-bold text-purple-800">{Number(row.extra_hours_value || 0).toFixed(2)} lei</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-2xl bg-orange-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-orange-600">Sâmbătă</p>
                            <p className="mt-0.5 text-lg font-bold text-orange-700">{row.is_saturday ? "Da" : "Nu"}</p>
                          </div>
                          <div className="rounded-2xl bg-orange-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-orange-600">Duminică</p>
                            <p className="mt-0.5 text-lg font-bold text-orange-700">{row.is_sunday ? "Da" : "Nu"}</p>
                          </div>
                          <div className="rounded-2xl bg-orange-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-orange-600">Zile</p>
                            <p className="mt-0.5 text-lg font-bold text-orange-700">{Number(row.weekend_days_count || 0)} zile</p>
                          </div>
                          <div className="rounded-2xl bg-orange-50 px-4 py-3">
                            <p className="text-[11px] font-medium text-orange-600">Valoare</p>
                            <p className="mt-0.5 text-lg font-bold text-orange-700">{Number(row.weekend_value || 0).toFixed(2)} lei</p>
                          </div>
                        </>
                      )}
                    </div>

                    {!isPaid && (
                      <button type="button"
                        onClick={() => category === "extra" ? handleMarkExtraPaid(row) : handleMarkWeekendPaid(row)}
                        disabled={isProcessing}
                        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${category === "extra" ? "bg-purple-600" : "bg-orange-500"}`}>
                        {isProcessing ? "Se procesează..." : "Marchează achitat"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
