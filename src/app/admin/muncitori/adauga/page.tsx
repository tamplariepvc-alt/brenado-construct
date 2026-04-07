"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdaugaMuncitorPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    const { error } = await supabase.from("workers").insert({
      full_name: fullName.trim(),
      job_title: jobTitle.trim() || null,
      monthly_salary: Number(monthlySalary),
      notes: notes.trim() || null,
      is_active: isActive,
    });

    if (error) {
      alert("A apărut o eroare la salvarea muncitorului.");
      setLoading(false);
      return;
    }

    setLoading(false);
    alert("Muncitor adăugat cu succes.");
    router.push("/admin/muncitori");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Adaugă muncitor</h1>
            <p className="text-sm text-gray-600">
              Completează datele de bază ale muncitorului.
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
                  placeholder="Ex: Montator, Finisor"
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
              disabled={loading}
              className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Se salvează..." : "Salvează muncitor"}
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