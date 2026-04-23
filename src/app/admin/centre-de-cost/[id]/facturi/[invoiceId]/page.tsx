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

type ProjectInvoice = {
  id: string;
  project_id: string;
  invoice_image_url: string | null;
  invoice_date: string;
  supplier: string | null;
  document_number: string | null;
  total_without_vat: number | null;
  total_with_vat: number | null;
  notes: string | null;
  created_at: string;
};

type ProjectInvoiceItem = {
  id: string;
  invoice_id: string;
  item_name: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  created_at: string;
};

export default function DetaliuFacturaCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const invoiceId = params.invoiceId as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [invoice, setInvoice] = useState<ProjectInvoice | null>(null);
  const [items, setItems] = useState<ProjectInvoiceItem[]>([]);

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

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("project_invoices")
        .select(`
          id,
          project_id,
          invoice_image_url,
          invoice_date,
          supplier,
          document_number,
          total_without_vat,
          total_with_vat,
          notes,
          created_at
        `)
        .eq("id", invoiceId)
        .eq("project_id", projectId)
        .single();

      if (invoiceError || !invoiceData) {
        router.push(`/admin/centre-de-cost/${projectId}/facturi`);
        return;
      }

      const { data: itemsData } = await supabase
        .from("project_invoice_items")
        .select(`
          id,
          invoice_id,
          item_name,
          quantity,
          unit_price,
          line_total,
          created_at
        `)
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      setProject(projectData as ProjectDetails);
      setInvoice(invoiceData as ProjectInvoice);
      setItems((itemsData as ProjectInvoiceItem[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, invoiceId, router]);

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  }, [items]);


  if (!project || !invoice) {
    return <div className="p-6">Factura nu a fost găsită.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu factură</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}/facturi`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la facturi
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                {invoice.document_number || "Factură fără număr"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Vezi datele complete ale facturii selectate.
              </p>
            </div>

            {invoice.invoice_image_url && (
              <div className="mb-5">
                <img
                  src={invoice.invoice_image_url}
                  alt="Factură"
                  className="max-h-[520px] w-full rounded-2xl border border-gray-200 bg-white object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500">Număr factură</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {invoice.document_number || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Data</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {invoice.invoice_date
                    ? new Date(invoice.invoice_date).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Furnizor</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {invoice.supplier || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Valoare fără TVA</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {Number(invoice.total_without_vat || 0).toFixed(2)} lei
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Valoare totală</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {Number(invoice.total_with_vat || 0).toFixed(2)} lei
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
              <h2 className="text-lg font-semibold">Materiale factură</h2>
              <p className="mt-1 text-sm text-gray-500">
                Materiale, cantități și valori extrase / salvate.
              </p>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Nu există materiale salvate pentru această factură.
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

          {invoice.notes && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <h2 className="mb-3 text-lg font-semibold">Observații</h2>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {invoice.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}