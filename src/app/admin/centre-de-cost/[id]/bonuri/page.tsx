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

type FiscalReceipt = {
  id: string;
  project_id: string;
  receipt_image_url: string | null;
  receipt_date: string;
  supplier: string | null;
  document_number: string | null;
  total_without_vat: number | null;
  total_with_vat: number | null;
  notes: string | null;
  created_at: string;
};

export default function BonuriCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);

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

      const { data: receiptsData } = await supabase
        .from("fiscal_receipts")
        .select(`
          id,
          project_id,
          receipt_image_url,
          receipt_date,
          supplier,
          document_number,
          total_without_vat,
          total_with_vat,
          notes,
          created_at
        `)
        .eq("project_id", projectId)
        .order("receipt_date", { ascending: false })
        .order("created_at", { ascending: false });

      setProject(projectData as ProjectDetails);
      setReceipts((receiptsData as FiscalReceipt[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, router]);

  const totals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        acc.count += 1;
        acc.totalWithoutVat += Number(receipt.total_without_vat || 0);
        acc.totalWithVat += Number(receipt.total_with_vat || 0);
        return acc;
      },
      {
        count: 0,
        totalWithoutVat: 0,
        totalWithVat: 0,
      }
    );
  }, [receipts]);

  if (loading) {
    return <div className="p-6">Se încarcă bonurile...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bonuri fiscale</h1>
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

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total bonuri</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totals.count}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Valoare fără TVA</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totals.totalWithoutVat.toFixed(2)} lei
            </p>
          </div>

          <div className="rounded-2xl bg-[#0196ff] p-5 text-white shadow">
            <p className="text-sm text-white/80">Valoare totală bonuri</p>
            <p className="mt-2 text-3xl font-bold">
              {totals.totalWithVat.toFixed(2)} lei
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-semibold">Lista bonuri</h2>
            <p className="mt-1 text-sm text-gray-500">
              Număr bon, furnizor și valoare.
            </p>
          </div>

          {receipts.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-500">
              Nu există bonuri încărcate pentru acest proiect.
            </div>
          ) : (
            <div className="divide-y">
              {receipts.map((receipt) => (
                <button
                  key={receipt.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/admin/centre-de-cost/${projectId}/bonuri/${receipt.id}`
                    )
                  }
                  className="w-full bg-white px-5 py-4 text-left transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-900">
                        {receipt.document_number || "Bon fără număr"}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        {receipt.supplier || "-"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {receipt.receipt_date
                          ? new Date(receipt.receipt_date).toLocaleDateString(
                              "ro-RO"
                            )
                          : "-"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">
                          {Number(receipt.total_with_vat || 0).toFixed(2)} lei
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