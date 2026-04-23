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