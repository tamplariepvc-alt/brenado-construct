"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

type WorkerLeave = {
  id: string;
  user_id: string;
  year: number;
  days_total: number;
  days_taken: number;
};

type LeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  notes: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
};

type Toast = { type: "success" | "error" | "warning"; message: string } | null;

const ROMANIAN_HOLIDAYS_2026 = [
  "2026-01-01", "2026-01-02", "2026-01-24",
  "2026-04-10", "2026-04-12", "2026-04-13",
  "2026-05-01", "2026-06-01", "2026-06-07",
  "2026-08-15", "2026-11-30", "2026-12-01",
  "2026-12-25", "2026-12-26",
];

const ROMANIAN_HOLIDAYS_2025 = [
  "2025-01-01", "2025-01-02", "2025-01-24",
  "2025-04-18", "2025-04-20", "2025-04-21",
  "2025-05-01", "2025-06-01", "2025-06-08",
  "2025-06-09", "2025-08-15", "2025-11-30",
  "2025-12-01", "2025-12-25", "2025-12-26",
];

function getHolidays(year: number): string[] {
  if (year === 2025) return ROMANIAN_HOLIDAYS_2025;
  if (year === 2026) return ROMANIAN_HOLIDAYS_2026;
  return [];
}

function countWorkingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (end < start) return 0;

  const years = Array.from(new Set([start.getFullYear(), end.getFullYear()]));
  const holidays = new Set(years.flatMap((y) => getHolidays(y)));

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    const dateStr = cursor.toISOString().split("T")[0];
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function getRoleLabel(role: string): string {
  if (role === "administrator") return "Administrator";
  if (role === "sef_echipa") return "Șef de echipă";
  if (role === "user") return "Utilizator";
  return role;
}

function getStatusLabel(status: string): string {
  if (status === "pending") return "În așteptare";
  if (status === "approved") return "Aprobată";
  if (status === "rejected") return "Respinsă";
  return status;
}

function getStatusClasses(status: string): string {
  if (status === "pending") return "bg-yellow-100 text-yellow-700";
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

export default function ProfilPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [workerLeave, setWorkerLeave] = useState<WorkerLeave | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [toast, setToast] = useState<Toast>(null);

  // Cerere concediu
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const currentYear = new Date().getFullYear();

  const showToast = (type: "success" | "error" | "warning", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const workingDays = useMemo(() => {
    return countWorkingDays(startDate, endDate);
  }, [startDate, endDate]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    setEmail(user.email || "");

    const { data: profileData } = await supabase
      .from("profiles").select("id, full_name, role").eq("id", user.id).single();
    if (!profileData) { router.push("/login"); return; }
    setProfile(profileData as Profile);

    const [leaveRes, requestsRes] = await Promise.all([
      supabase.from("worker_leave")
        .select("id, user_id, year, days_total, days_taken")
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .single(),
      supabase.from("leave_requests")
        .select("id, user_id, start_date, end_date, days_count, notes, status, created_at, approved_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setWorkerLeave((leaveRes.data as WorkerLeave) || null);
    setLeaveRequests((requestsRes.data as LeaveRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [router]);

  const handleSubmitRequest = async () => {
    if (!startDate || !endDate) {
      showToast("error", "Selectează data de început și de sfârșit."); return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showToast("error", "Data de sfârșit nu poate fi înainte de data de început."); return;
    }
    if (workingDays === 0) {
      showToast("error", "Perioada selectată nu conține zile lucrătoare."); return;
    }
    if (!confirmSubmit) {
      setConfirmSubmit(true); return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSubmitting(true);

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      days_count: workingDays,
      notes: notes.trim() || null,
      status: "pending",
    });

    if (error) {
      showToast("error", `Eroare: ${error.message}`);
      setSubmitting(false);
      setConfirmSubmit(false);
      return;
    }

    setSubmitting(false);
    setConfirmSubmit(false);
    setShowForm(false);
    setStartDate(""); setEndDate(""); setNotes("");
    await loadData();
    showToast("success", "Cererea de concediu a fost trimisă cu succes.");
  };

  const handleExportPdf = async (request: LeaveRequest) => {
    if (!profile) return;

    const doc = new jsPDF("p", "mm", "a4");

    try {
      const logo = new window.Image();
      logo.src = "/logo.png";
      await new Promise((r) => { logo.onload = r; logo.onerror = r; });
      doc.addImage(logo, "PNG", 14, 10, 42, 13);
    } catch {}

    doc.setDrawColor(1, 150, 255); doc.setLineWidth(0.6); doc.line(14, 28, 196, 28);
    doc.setFontSize(17); doc.setTextColor(0, 86, 179);
    doc.text("Cerere de concediu", 14, 38);

    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 45);

    doc.setFontSize(11); doc.setTextColor(0);
    doc.text("Date solicitant", 14, 58);
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(`Nume: ${profile.full_name}`, 14, 65);
    doc.text(`Functie: ${getRoleLabel(profile.role)}`, 14, 71);
    doc.text(`Email: ${email}`, 14, 77);

    doc.setFontSize(11); doc.setTextColor(0);
    doc.text("Detalii concediu", 14, 90);
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(`Data început: ${new Date(request.start_date).toLocaleDateString("ro-RO")}`, 14, 97);
    doc.text(`Data sfarsit: ${new Date(request.end_date).toLocaleDateString("ro-RO")}`, 14, 103);
    doc.text(`Zile lucratoare: ${request.days_count}`, 14, 109);
    doc.text(`Status: ${getStatusLabel(request.status)}`, 14, 115);
    if (request.notes) doc.text(`Observatii: ${request.notes}`, 14, 121);

    if (request.status === "approved") {
      doc.setFontSize(11); doc.setTextColor(20, 120, 60);
      doc.text("✓ Aprobată", 14, 135);
      doc.setFontSize(9); doc.setTextColor(60);
      if (request.approved_at) {
        doc.text(`Data aprobării: ${new Date(request.approved_at).toLocaleDateString("ro-RO")}`, 14, 142);
      }
    }

    doc.setFontSize(10); doc.setTextColor(0);
    doc.text("Semnatura solicitant:", 14, 200);
    doc.text("Semnatura administrator:", 110, 200);

    doc.setFontSize(8); doc.setTextColor(120);
    doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);

    doc.save(`cerere_concediu_${profile.full_name.replace(/\s+/g, "_")}_${request.start_date}.pdf`);
  };

  const daysRemaining = workerLeave
    ? workerLeave.days_total - workerLeave.days_taken
    : null;

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#0196ff] sm:h-7 sm:w-7">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0196ff]/10">{renderIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Se încarcă profilul...</p>
              <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${
            toast.type === "success" ? "border-green-300 bg-green-50 text-green-800"
            : toast.type === "error" ? "border-red-300 bg-red-50 text-red-800"
            : "border-yellow-300 bg-yellow-50 text-yellow-800"
          }`}>
            {toast.type === "success" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-600" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {toast.type === "error" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
            {toast.type === "warning" && (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-yellow-500" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              </svg>
            )}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMARE CERERE */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-yellow-600" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-center text-lg font-bold text-gray-900">Trimiți cererea de concediu?</h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                Cererea va fi trimisă administratorului pentru aprobare.
              </p>
              <div className="mt-4 rounded-2xl border border-[#0196ff]/20 bg-[#0196ff]/5 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  {startDate ? new Date(startDate).toLocaleDateString("ro-RO") : "-"} → {endDate ? new Date(endDate).toLocaleDateString("ro-RO") : "-"}
                </p>
                <p className="mt-1 text-xl font-extrabold text-[#0196ff]">{workingDays} zile lucrătoare</p>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={handleSubmitRequest} disabled={submitting}
                  className="flex-1 rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                  {submitting ? "Se trimite..." : "Da, trimite cererea"}
                </button>
                <button type="button" onClick={() => setConfirmSubmit(false)} disabled={submitting}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Date cont */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#0196ff]/10 sm:h-20 sm:w-20">
              <span className="text-2xl font-extrabold text-[#0196ff] sm:text-3xl">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {profile?.full_name || "-"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{email}</p>
              <span className="mt-2 inline-block rounded-full bg-[#0196ff]/10 px-3 py-1 text-xs font-semibold text-[#0196ff]">
                {getRoleLabel(profile?.role || "")}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Nume complet</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{profile?.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Email</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 break-all">{email || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Funcție</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{getRoleLabel(profile?.role || "")}</p>
            </div>
          </div>
        </section>

        {/* Zile concediu */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Concediu {currentYear}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {!workerLeave ? (
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-5 text-center">
              <p className="text-sm text-gray-500">Nu există înregistrări de concediu pentru {currentYear}.</p>
              <p className="mt-1 text-xs text-gray-400">Administratorul va configura zilele tale de concediu.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4 text-center">
                  <p className="text-3xl font-extrabold text-gray-900">{workerLeave.days_total}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Zile totale</p>
                </div>
                <div className="rounded-2xl bg-orange-50 px-4 py-4 text-center">
                  <p className="text-3xl font-extrabold text-orange-600">{workerLeave.days_taken}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-orange-400">Zile luate</p>
                </div>
                <div className={`rounded-2xl px-4 py-4 text-center ${
                  daysRemaining! < 0 ? "bg-red-50" : daysRemaining === 0 ? "bg-gray-100" : "bg-green-50"
                }`}>
                  <p className={`text-3xl font-extrabold ${
                    daysRemaining! < 0 ? "text-red-600" : daysRemaining === 0 ? "text-gray-500" : "text-green-700"
                  }`}>{daysRemaining}</p>
                  <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${
                    daysRemaining! < 0 ? "text-red-400" : daysRemaining === 0 ? "text-gray-400" : "text-green-400"
                  }`}>Zile rămase</p>
                </div>
              </div>

              {/* Bară progres */}
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (workerLeave.days_taken / workerLeave.days_total) >= 1 ? "bg-red-500"
                      : (workerLeave.days_taken / workerLeave.days_total) >= 0.75 ? "bg-orange-400"
                      : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, (workerLeave.days_taken / workerLeave.days_total) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-gray-400">
                  {workerLeave.days_taken} din {workerLeave.days_total} zile folosite
                </p>
              </div>
            </>
          )}

          {/* Buton cerere concediu */}
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setConfirmSubmit(false); }}
            className="mt-4 w-full rounded-xl bg-[#0196ff] py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {showForm ? "Închide formularul" : "+ Cerere concediu"}
          </button>

          {/* Formular cerere */}
          {showForm && (
            <div className="mt-4 rounded-2xl border border-[#0196ff]/20 bg-[#0196ff]/5 p-4">
              <div className="mb-3 flex items-center gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Cerere nouă</p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">Data început <span className="text-red-500">*</span></label>
                  <input type="date" value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setConfirmSubmit(false); }}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0196ff]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">Data sfârșit <span className="text-red-500">*</span></label>
                  <input type="date" value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setConfirmSubmit(false); }}
                    min={startDate || new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0196ff]" />
                </div>
              </div>

              {/* Preview zile lucrătoare */}
              {startDate && endDate && (
                <div className="mt-3 rounded-xl border border-[#0196ff]/20 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Zile lucrătoare calculate</p>
                    <p className="text-lg font-extrabold text-[#0196ff]">{workingDays} zile</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-400">Weekend-urile și sărbătorile legale nu sunt incluse.</p>
                  {daysRemaining !== null && workingDays > daysRemaining && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      ⚠ Depășești soldul disponibil cu {workingDays - daysRemaining} zile.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Observații (opțional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Ex: concediu medical, odihnă, etc."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0196ff]" />
              </div>

              <button type="button" onClick={handleSubmitRequest} disabled={submitting || !startDate || !endDate || workingDays === 0}
                className="mt-3 w-full rounded-xl bg-[#0196ff] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {submitting ? "Se trimite..." : "Trimite cererea"}
              </button>
            </div>
          )}
        </section>

        {/* Istoricul cererilor */}
        {leaveRequests.length > 0 && (
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Istoricul cererilor</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">{leaveRequests.length} cereri</p>
              </div>
            </div>

            <div className="divide-y divide-[#F0EEE9]">
              {leaveRequests.map((req) => (
                <div key={req.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(req.start_date).toLocaleDateString("ro-RO")} → {new Date(req.end_date).toLocaleDateString("ro-RO")}
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusClasses(req.status)}`}>
                          {getStatusLabel(req.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {req.days_count} zile lucrătoare · Trimisă {new Date(req.created_at).toLocaleDateString("ro-RO")}
                      </p>
                      {req.notes && <p className="mt-0.5 text-xs italic text-gray-400">"{req.notes}"</p>}
                    </div>
                    <button type="button" onClick={() => handleExportPdf(req)}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
                        <path d="M12 16V4M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 20h16" strokeLinecap="round" />
                      </svg>
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
