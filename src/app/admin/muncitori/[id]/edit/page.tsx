"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type WorkerType = "executie" | "tesa";

export default function EditPersonalPage() {
  const router = useRouter();
  const params = useParams();
  const workerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [workerType, setWorkerType] = useState<WorkerType>("executie");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [extraHourRate, setExtraHourRate] = useState("");
  const [weekendDayRate, setWeekendDayRate] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const loadWorker = async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("id, full_name, job_title, monthly_salary, extra_hour_rate, weekend_day_rate, notes, is_active, worker_type")
        .eq("id", workerId)
        .single();

      if (error || !data) {
        alert("Persoana nu a fost găsită.");
        router.push("/admin/muncitori");
        return;
      }

      setFullName(data.full_name || "");
      setJobTitle(data.job_title || "");
      setMonthlySalary(data.monthly_salary != null ? String(data.monthly_salary) : "");
      setExtraHourRate(data.extra_hour_rate != null ? String(data.extra_hour_rate) : "");
      setWeekendDayRate(data.weekend_day_rate != null ? String(data.weekend_day_rate) : "");
      setNotes(data.notes || "");
      setIsActive(Boolean(data.is_active));
      setWorkerType((data.worker_type as WorkerType) || "executie");
      setLoading(false);
    };

    loadWorker();
  }, [workerId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) { alert("Completează numele."); return; }
    if (!monthlySalary || Number(monthlySalary) <= 0) { alert("Completează salariul lunar."); return; }

    setSaving(true);

    const { error } = await supabase
      .from("workers")
      .update({
        full_name: fullName.trim(),
        job_title: jobTitle.trim() || null,
        monthly_salary: Number(monthlySalary),
        extra_hour_rate: extraHourRate ? Number(extraHourRate) : 0,
        weekend_day_rate: weekendDayRate ? Number(weekendDayRate) : 0,
        notes: notes.trim() || null,
        is_active: isActive,
        worker_type: workerType,
      })
      .eq("id", workerId);

    if (error) {
      alert("A apărut o eroare la salvarea modificărilor.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push("/admin/muncitori");
  };

  const handleDelete = async () => {
    setDeleting(true);

    const { error } = await supabase
      .from("workers")
      .delete()
      .eq("id", workerId);

    if (error) {
      alert("A apărut o eroare la ștergere.");
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/admin/muncitori");
  };

  const renderWorkerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
              {renderWorkerIcon()}
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
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <button
            onClick={() => router.push("/admin/muncitori")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la personal
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                {renderWorkerIcon()}
              </div>
              <div>
                <p className="text-sm text-gray-500">Administrare personal</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  Editează personal
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-gray-500">{fullName || "—"}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    workerType === "tesa"
                      ? "bg-[#0196ff]/10 text-[#0196ff]"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {workerType === "tesa" ? "TESA" : "Execuție"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              Șterge
            </button>
          </div>
        </section>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          {/* Tip personal */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Categorie personal
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWorkerType("executie")}
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  workerType === "executie"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Personal de execuție
              </button>
              <button
                type="button"
                onClick={() => setWorkerType("tesa")}
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  workerType === "tesa"
                    ? "border-[#0196ff] bg-[#0196ff] text-white"
                    : "border-[#0196ff]/20 bg-[#0196ff]/5 text-[#0196ff] hover:bg-[#0196ff]/10"
                }`}
              >
                TESA
              </button>
            </div>
          </section>

          {/* Date personale */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Date personale
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nume complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Introdu numele complet"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Funcție
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={workerType === "tesa" ? "Ex: Inginer, Contabil" : "Ex: Montator, Finisor"}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium text-gray-800">Personal activ</span>
                </label>
              </div>
            </div>
          </section>

          {/* Tarife */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Tarife și salariu
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Salariu lunar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="Ex: 4500"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-gray-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Tarif oră extra
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraHourRate}
                    onChange={(e) => setExtraHourRate(e.target.value)}
                    placeholder="Ex: 35"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-16 text-sm outline-none transition focus:border-gray-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei/h</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Tarif zi weekend
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={weekendDayRate}
                    onChange={(e) => setWeekendDayRate(e.target.value)}
                    placeholder="Ex: 250"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-gray-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                </div>
              </div>
            </div>
          </section>

          {/* Observatii */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Observații
              </p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observații interne opționale..."
              rows={4}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />
          </section>

          {/* Butoane */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Se salvează..." : "Salvează modificările"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/muncitori")}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
            >
              Renunță
            </button>
          </div>
        </form>
      </main>

      {/* Modal confirmare stergere */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-red-600">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-extrabold text-gray-900">Șterge persoana</h2>
              <p className="mt-2 text-sm text-gray-500">
                Ești sigur că vrei să ștergi{" "}
                <span className="font-semibold text-gray-800">{fullName}</span>?
                Această acțiune nu poate fi anulată.
              </p>
            </div>
            <div className="flex gap-3 border-t border-[#E8E5DE] px-6 py-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Se șterge..." : "Da, șterge"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
