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
    return <div className="p-6">Se încarcă muncitorul...</div>;
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