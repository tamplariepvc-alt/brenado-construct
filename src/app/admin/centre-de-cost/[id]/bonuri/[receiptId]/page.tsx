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

type FiscalReceiptItem = {
  id: string;
  receipt_id: string;
  item_name: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  created_at: string;
};

export default function DetaliuBonCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const receiptId = params.receiptId as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [receipt, setReceipt] = useState<FiscalReceipt | null>(null);
  const [items, setItems] = useState<FiscalReceiptItem[]>([]);

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

      const { data: receiptData, error: receiptError } = await supabase
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
        .eq("id", receiptId)
        .eq("project_id", projectId)
        .single();

      if (receiptError || !receiptData) {
        router.push(`/admin/centre-de-cost/${projectId}/bonuri`);
        return;
      }

      const { data: itemsData } = await supabase
        .from("fiscal_receipt_items")
        .select(`
          id,
          receipt_id,
          item_name,
          quantity,
          unit_price,
          line_total,
          created_at
        `)
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: true });

      setProject(projectData as ProjectDetails);
      setReceipt(receiptData as FiscalReceipt);
      setItems((itemsData as FiscalReceiptItem[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, receiptId, router]);

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  }, [items]);

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

  if (!project || !receipt) {
    return <div className="p-6">Bonul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu bon</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}/bonuri`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la bonuri
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                {receipt.document_number || "Bon fără număr"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Vezi datele complete ale bonului selectat.
              </p>
            </div>

            {receipt.receipt_image_url && (
              <div className="mb-5">
                <img
                  src={receipt.receipt_image_url}
                  alt="Bon fiscal"
                  className="max-h-[520px] w-full rounded-2xl border border-gray-200 bg-white object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Număr bon</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {receipt.document_number || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Data</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {receipt.receipt_date
                    ? new Date(receipt.receipt_date).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Furnizor</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {receipt.supplier || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Valoare fără TVA</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {Number(receipt.total_without_vat || 0).toFixed(2)} lei
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Valoare totală</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {Number(receipt.total_with_vat || 0).toFixed(2)} lei
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Total materiale</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {itemsTotal.toFixed(2)} lei
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Materiale bon</h2>
              <p className="mt-1 text-sm text-gray-500">
                Materiale, cantități și valori extrase / salvate.
              </p>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Nu există materiale salvate pentru acest bon.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {item.item_name}
                    </p>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-3">
                      <p>
                        <span className="font-medium text-gray-500">Cantitate:</span>{" "}
                        {Number(item.quantity || 0).toFixed(2)}
                      </p>

                      <p>
                        <span className="font-medium text-gray-500">Preț unitar:</span>{" "}
                        {Number(item.unit_price || 0).toFixed(2)} lei
                      </p>

                      <p>
                        <span className="font-medium text-gray-500">Total:</span>{" "}
                        {Number(item.line_total || 0).toFixed(2)} lei
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {receipt.notes && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <h2 className="mb-3 text-lg font-semibold">Observații</h2>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {receipt.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}