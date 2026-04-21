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

export default function BonuriCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);
  const [receiptItems, setReceiptItems] = useState<FiscalReceiptItem[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<FiscalReceipt | null>(null);

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

      const { data: receiptsData, error: receiptsError } = await supabase
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

      const receiptIds = ((receiptsData as FiscalReceipt[]) || []).map((r) => r.id);

      let itemsData: FiscalReceiptItem[] = [];

      if (!receiptsError && receiptIds.length > 0) {
        const { data: fetchedItems } = await supabase
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
          .in("receipt_id", receiptIds)
          .order("created_at", { ascending: true });

        itemsData = (fetchedItems as FiscalReceiptItem[]) || [];
      }

      const parsedReceipts = (receiptsData as FiscalReceipt[]) || [];

      setProject(projectData as ProjectDetails);
      setReceipts(parsedReceipts);
      setReceiptItems(itemsData);

      if (parsedReceipts.length > 0) {
        setSelectedReceipt(parsedReceipts[0]);
      }

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

  const selectedReceiptItems = useMemo(() => {
    if (!selectedReceipt) return [];
    return receiptItems.filter((item) => item.receipt_id === selectedReceipt.id);
  }, [receiptItems, selectedReceipt]);

  if (loading) {
    return <div className="p-6">Se încarcă bonurile...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
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
            <p className="mt-2 text-3xl font-bold text-gray-900">{totals.count}</p>
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

        {receipts.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Nu există bonuri încărcate pentru acest proiect.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl bg-white shadow">
              <div className="border-b px-5 py-4">
                <h2 className="text-lg font-semibold">Lista bonuri</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Număr bon, furnizor și valoare.
                </p>
              </div>

              <div className="divide-y">
                {receipts.map((receipt) => (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => setSelectedReceipt(receipt)}
                    className={`w-full px-5 py-4 text-left transition hover:bg-gray-50 ${
                      selectedReceipt?.id === receipt.id ? "bg-blue-50" : "bg-white"
                    }`}
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
                            ? new Date(receipt.receipt_date).toLocaleDateString("ro-RO")
                            : "-"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-gray-900">
                          {Number(receipt.total_with_vat || 0).toFixed(2)} lei
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              {!selectedReceipt ? (
                <p className="text-sm text-gray-500">Selectează un bon.</p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">Detaliu bon</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Vezi datele complete ale bonului selectat.
                    </p>
                  </div>

                  {selectedReceipt.receipt_image_url && (
                    <div>
                      <img
                        src={selectedReceipt.receipt_image_url}
                        alt="Bon fiscal"
                        className="max-h-[420px] w-full rounded-2xl border border-gray-200 object-contain bg-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Număr bon</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedReceipt.document_number || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500">Data</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedReceipt.receipt_date
                          ? new Date(selectedReceipt.receipt_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500">Furnizor</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedReceipt.supplier || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500">Valoare fără TVA</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {Number(selectedReceipt.total_without_vat || 0).toFixed(2)} lei
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500">Valoare totală</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {Number(selectedReceipt.total_with_vat || 0).toFixed(2)} lei
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-base font-semibold">Materiale bon</h3>

                    {selectedReceiptItems.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        Nu există materiale salvate pentru acest bon.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedReceiptItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                          >
                            <p className="text-sm font-semibold text-gray-900">
                              {item.item_name}
                            </p>

                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-3">
                              <p>
                                <span className="font-medium text-gray-500">
                                  Cantitate:
                                </span>{" "}
                                {Number(item.quantity || 0).toFixed(2)}
                              </p>

                              <p>
                                <span className="font-medium text-gray-500">
                                  Preț unitar:
                                </span>{" "}
                                {Number(item.unit_price || 0).toFixed(2)} lei
                              </p>

                              <p>
                                <span className="font-medium text-gray-500">
                                  Total:
                                </span>{" "}
                                {Number(item.line_total || 0).toFixed(2)} lei
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedReceipt.notes && (
                    <div>
                      <h3 className="mb-2 text-base font-semibold">Observații</h3>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {selectedReceipt.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}