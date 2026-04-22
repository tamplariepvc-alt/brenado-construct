"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function NedeductibileCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [expenses, setExpenses] = useState<NondeductibleExpense[]>([]);

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

      const { data: expensesData } = await supabase
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
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      setProject(projectData as ProjectDetails);
      setExpenses((expensesData as NondeductibleExpense[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, router]);

  const totals = useMemo(() => {
    return expenses.reduce(
      (acc, item) => {
        acc.count += 1;
        acc.total += Number(item.cost_ron || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [expenses]);

  if (loading) {
    return <div className="p-6">Se încarcă nedeductibilele...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nedeductibile</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la centru de cost
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total înregistrări</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totals.count}</p>
          </div>

          <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
            <p className="text-sm text-white/80">Valoare totală nedeductibile</p>
            <p className="mt-2 text-3xl font-bold">{totals.total.toFixed(2)} lei</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-semibold">Lista servicii nedeductibile</h2>
            <p className="mt-1 text-sm text-gray-500">
              Serviciu, dată și valoare.
            </p>
          </div>

          {expenses.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-500">
              Nu există cheltuieli nedeductibile pentru acest proiect.
            </div>
          ) : (
            <div className="divide-y">
              {expenses.map((expense) => (
                <button
                  key={expense.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/admin/centre-de-cost/${projectId}/nedeductibile/${expense.id}`
                    )
                  }
                  className="w-full bg-white px-5 py-4 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-900">
                        {expense.service_name || "Serviciu fără nume"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {expense.expense_date
                          ? new Date(expense.expense_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">
                          {Number(expense.cost_ron || 0).toFixed(2)} lei
                        </p>
                      </div>

                      <div className="text-3xl font-light text-gray-400">→</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}