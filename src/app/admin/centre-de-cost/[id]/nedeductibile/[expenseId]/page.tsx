"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ProjectDetails = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
};

type NondeductibleExpense = {
  id: string;
  project_id: string;
  expense_date: string;
  service_name: string | null;
  cost_ron: number | null;
  notes: string | null;
  created_at: string;
};

export default function DetaliuNedeductibilPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const expenseId = params.expenseId as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [expense, setExpense] = useState<NondeductibleExpense | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, beneficiary, project_location")
        .eq("id", projectId)
        .single();

      if (projectError || !projectData) {
        router.push("/admin/centre-de-cost");
        return;
      }

      const { data: expenseData, error: expenseError } = await supabase
        .from("project_nondeductible_expenses")
        .select(`
          id,
          project_id,
          expense_date,
          service_name,
          cost_ron,
          notes,
          created_at
        `)
        .eq("id", expenseId)
        .eq("project_id", projectId)
        .single();

      if (expenseError || !expenseData) {
        router.push(`/admin/centre-de-cost/${projectId}/nedeductibile`);
        return;
      }

      setProject(projectData as ProjectDetails);
      setExpense(expenseData as NondeductibleExpense);
      setLoading(false);
    };

    loadData();
  }, [projectId, expenseId, router]);

  if (loading) {
    return <div className="p-6">Se încarcă detaliile...</div>;
  }

  if (!project || !expense) {
    return <div className="p-6">Înregistrarea nu a fost găsită.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu nedeductibil</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() =>
              router.push(`/admin/centre-de-cost/${projectId}/nedeductibile`)
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la nedeductibile
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {expense.service_name || "Serviciu fără nume"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Vezi datele complete ale cheltuielii nedeductibile.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-500">Serviciu</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {expense.service_name || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">Data</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {expense.expense_date
                  ? new Date(expense.expense_date).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">Cost</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {Number(expense.cost_ron || 0).toFixed(2)} lei
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500">Data înregistrării</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {expense.created_at
                  ? new Date(expense.created_at).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>
          </div>

          {expense.notes && (
            <div className="mt-6">
              <h3 className="mb-2 text-base font-semibold">Observații</h3>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {expense.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}