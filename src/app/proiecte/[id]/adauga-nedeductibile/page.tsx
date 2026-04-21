"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location?: string | null;
};

export default function AdaugaNedeductibilePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState<Project | null>(null);

  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [serviceName, setServiceName] = useState("");
  const [costRon, setCostRon] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const loadProject = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, beneficiary, project_location")
        .eq("id", projectId)
        .single();

      if (error || !data) {
        router.push("/proiecte");
        return;
      }

      setProject(data as Project);
      setLoading(false);
    };

    loadProject();
  }, [projectId, router]);

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!expenseDate) {
      alert("Completeaza data.");
      return;
    }

    if (!serviceName.trim()) {
      alert("Completeaza serviciul.");
      return;
    }

    if (!costRon || Number(costRon) <= 0) {
      alert("Completeaza costul serviciului.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("project_nondeductible_expenses")
      .insert({
        project_id: projectId,
        added_by: user.id,
        expense_date: expenseDate,
        service_name: serviceName.trim(),
        cost_ron: Number(costRon),
        notes: notes.trim() || null,
      });

    if (error) {
      alert(`A aparut o eroare la salvare: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Cheltuiala nedeductibila a fost salvata.");
    router.push("/proiecte");
  };

  if (loading) {
    return <div className="p-6">Se incarca proiectul...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost gasit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Adauga Nedeductibile</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Inapoi
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Data
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Serviciu
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Ex: transport, consultanta, taxe, cazare"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Cost serviciu (RON)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costRon}
                onChange={(e) => setCostRon(e.target.value)}
                placeholder="Ex: 250"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Observatii
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Se salveaza..." : "Salveaza nedeductibila"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}