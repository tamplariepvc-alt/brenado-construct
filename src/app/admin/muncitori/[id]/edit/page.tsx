"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function EditMuncitorPage() {
  const router = useRouter();
  const params = useParams();
  const workerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        .select(
          "id, full_name, job_title, monthly_salary, extra_hour_rate, weekend_day_rate, notes, is_active"
        )
        .eq("id", workerId)
        .single();

      if (error || !data) {
        alert("Muncitorul nu a fost găsit.");
        router.push("/admin/muncitori");
        return;
      }

      setFullName(data.full_name || "");
      setJobTitle(data.job_title || "");
      setMonthlySalary(
        data.monthly_salary !== null && data.monthly_salary !== undefined
          ? String(data.monthly_salary)
          : ""
      );
      setExtraHourRate(
        data.extra_hour_rate !== null && data.extra_hour_rate !== undefined
          ? String(data.extra_hour_rate)
          : ""
      );
      setWeekendDayRate(
        data.weekend_day_rate !== null && data.weekend_day_rate !== undefined
          ? String(data.weekend_day_rate)
          : ""
      );
      setNotes(data.notes || "");
      setIsActive(Boolean(data.is_active));
      setLoading(false);
    };

    loadWorker();
  }, [workerId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      alert("Completează numele muncitorului.");
      return;
    }

    if (!monthlySalary || Number(monthlySalary) <= 0) {
      alert("Completează salariul lunar.");
      return;
    }

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
      })
      .eq("id", workerId);

    if (error) {
      alert("A apărut o eroare la salvarea modificărilor.");
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Muncitor actualizat cu succes.");
    router.push("/admin/muncitori");
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
            <p className="text-[15px] font-semibold text-gray-900">Se încarcă muncitorul...</p>
            <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Editează muncitor</h1>
            <p className="text-sm text-gray-600">
              Modifică datele muncitorului și tarifele de calcul.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/muncitori")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la muncitori
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Nume complet *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Introdu numele muncitorului"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Funcție
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Muncitor, Montator"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Salariu lunar *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  placeholder="Ex: 4500"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Muncitor activ
                  </span>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tarif oră extra
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraHourRate}
                  onChange={(e) => setExtraHourRate(e.target.value)}
                  placeholder="Ex: 35"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tarif zi weekend
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={weekendDayRate}
                  onChange={(e) => setWeekendDayRate(e.target.value)}
                  placeholder="Ex: 250"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Observații
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observații interne"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Se salvează..." : "Salvează modificările"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/muncitori")}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunță
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}