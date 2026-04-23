"use client";

import Image from "next/image";
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

export default function FacturiCentruCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);

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

      const { data: invoicesData } = await supabase
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
        .eq("project_id", projectId)
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false });

      setProject(projectData as ProjectDetails);
      setInvoices((invoicesData as ProjectInvoice[]) || []);
      setLoading(false);
    };

    loadData();
  }, [projectId, router]);

  const totals = useMemo(() => {
    return invoices.reduce(
      (acc, invoice) => {
        acc.count += 1;
        acc.totalWithoutVat += Number(invoice.total_without_vat || 0);
        acc.totalWithVat += Number(invoice.total_with_vat || 0);
        return acc;
      },
      {
        count: 0,
        totalWithoutVat: 0,
        totalWithVat: 0,
      }
    );
  }, [invoices]);

  const renderInvoiceIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect
        x="6"
        y="4"
        width="12"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 9h6M9 13h6M9 17h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );



  if (!project) {
    return <div className="p-6">Proiectul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>

          <button
            onClick={() => router.push(`/admin/centre-de-cost/${projectId}`)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la centru de cost
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                  {renderInvoiceIcon()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Facturi</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {project.name}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-gray-400">
                    {project.beneficiary || "-"}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm text-gray-500 sm:text-base">
                Vezi toate facturile încărcate pentru acest proiect și valorile
                lor cumulate.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Total facturi</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {totals.count}
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Valoare fără TVA</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {totals.totalWithoutVat.toFixed(2)} lei
              </p>
            </div>

            <div className="rounded-[22px] bg-[#0196ff] p-4 text-white shadow-sm">
              <p className="text-sm text-white/80">Valoare totală facturi</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {totals.totalWithVat.toFixed(2)} lei
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista facturi
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există facturi încărcate pentru acest proiect.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-3">Număr factură</div>
                  <div className="col-span-3">Furnizor</div>
                  <div className="col-span-2">Data</div>
                  <div className="col-span-3">Valoare</div>
                  <div className="col-span-1"></div>
                </div>

                {invoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/admin/centre-de-cost/${projectId}/facturi/${invoice.id}`
                      )
                    }
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-3 text-sm font-semibold text-gray-900">
                      {invoice.document_number || "Factură fără număr"}
                    </div>

                    <div className="col-span-3 text-sm text-gray-600">
                      {invoice.supplier || "-"}
                    </div>

                    <div className="col-span-2 text-sm text-gray-500">
                      {invoice.invoice_date
                        ? new Date(invoice.invoice_date).toLocaleDateString("ro-RO")
                        : "-"}
                    </div>

                    <div className="col-span-3 text-sm font-bold text-gray-900">
                      {Number(invoice.total_with_vat || 0).toFixed(2)} lei
                    </div>

                    <div className="col-span-1 text-right text-2xl font-light text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 lg:hidden">
                {invoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/admin/centre-de-cost/${projectId}/facturi/${invoice.id}`
                      )
                    }
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderInvoiceIcon()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900">
                              {invoice.document_number || "Factură fără număr"}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {invoice.supplier || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {Number(invoice.total_with_vat || 0).toFixed(2)} lei
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pr-10">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                        Data facturii
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {invoice.invoice_date
                          ? new Date(invoice.invoice_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>

                    <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EEE9] text-base text-gray-400">
                      ›
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}