"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type FundingDetails = {
  id: string;
  project_id: string;
  added_by: string;
  team_lead_user_id: string;
  amount_ron: number | null;
  funding_type: "card" | "cont";
  funding_date: string;
  notes: string | null;
  created_at: string;
};

type ProjectDetails = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
  status: string;
  cost_center_code: string | null;
};

type ProfileMini = {
  id: string;
  full_name: string;
};

export default function DetaliuAlimentarePage() {
  const router = useRouter();
  const params = useParams();
  const fundingId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [funding, setFunding] = useState<FundingDetails | null>(null);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [teamLead, setTeamLead] = useState<ProfileMini | null>(null);
  const [adminProfile, setAdminProfile] = useState<ProfileMini | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: fundingData, error: fundingError } = await supabase
        .from("project_fundings")
        .select(`
          id, project_id, added_by, team_lead_user_id,
          amount_ron, funding_type, funding_date, notes, created_at
        `)
        .eq("id", fundingId)
        .single();

      if (fundingError || !fundingData) {
        router.push("/admin/alimentari");
        return;
      }

      const fundingRow = fundingData as FundingDetails;

      const [projectRes, teamLeadRes, adminRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, beneficiary, project_location, status, cost_center_code")
          .eq("id", fundingRow.project_id)
          .single(),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", fundingRow.team_lead_user_id)
          .single(),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", fundingRow.added_by)
          .single(),
      ]);

      setFunding(fundingRow);
      setProject((projectRes.data as ProjectDetails) || null);
      setTeamLead((teamLeadRes.data as ProfileMini) || null);
      setAdminProfile((adminRes.data as ProfileMini) || null);
      setLoading(false);
    };

    loadData();
  }, [fundingId, router]);

  const getFundingTypeLabel = (type: string) => {
    if (type === "card") return "Card";
    if (type === "cont") return "Cont";
    return type;
  };

  const getFundingTypeClasses = (type: string) => {
    if (type === "card") return "bg-green-100 text-green-700";
    if (type === "cont") return "bg-[#0196ff]/10 text-[#0196ff]";
    return "bg-gray-100 text-gray-700";
  };

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getProjectStatusStyle = (status: string) => {
    if (status === "in_asteptare") return "bg-yellow-100 text-yellow-700";
    if (status === "in_lucru") return "bg-[#0196ff]/10 text-[#0196ff]";
    if (status === "finalizat") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const handleExportPdf = () => {
    if (!funding) return;

    const html = `
      <html>
        <head>
          <title>Detaliu alimentare</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            .muted { color: #6b7280; margin-bottom: 18px; }
            .section { margin-top: 20px; padding: 16px; border: 1px solid #d1d5db; border-radius: 10px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 14px; }
            .row { margin-bottom: 12px; }
            .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
            .value { font-size: 16px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Detaliu alimentare</h1>
          <div class="muted">Raport generat la ${new Date().toLocaleString("ro-RO")}</div>
          <div class="section">
            <div class="section-title">Date proiect</div>
            <div class="row"><div class="label">Proiect</div><div class="value">${project?.name || "-"}</div></div>
            <div class="row"><div class="label">Cod centru de cost</div><div class="value">${project?.cost_center_code || "-"}</div></div>
            <div class="row"><div class="label">Beneficiar</div><div class="value">${project?.beneficiary || "-"}</div></div>
            <div class="row"><div class="label">Locație</div><div class="value">${project?.project_location || "-"}</div></div>
            <div class="row"><div class="label">Status proiect</div><div class="value">${getProjectStatusLabel(project?.status || "")}</div></div>
            <div class="row"><div class="label">Șef șantier</div><div class="value">${teamLead?.full_name || "-"}</div></div>
            <div class="row"><div class="label">Alimentat de</div><div class="value">${adminProfile?.full_name || "-"}</div></div>
          </div>
          <div class="section">
            <div class="section-title">Date alimentare</div>
            <div class="row"><div class="label">Tip alimentare</div><div class="value">${getFundingTypeLabel(funding.funding_type)}</div></div>
            <div class="row"><div class="label">Sumă alimentată</div><div class="value">${Number(funding.amount_ron || 0).toFixed(2)} lei</div></div>
            <div class="row"><div class="label">Data alimentării</div><div class="value">${funding.funding_date ? new Date(funding.funding_date).toLocaleDateString("ro-RO") : "-"}</div></div>
            <div class="row"><div class="label">Creată la</div><div class="value">${funding.created_at ? new Date(funding.created_at).toLocaleDateString("ro-RO") : "-"}</div></div>
            <div class="row"><div class="label">Observații</div><div class="value">${funding.notes || "-"}</div></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Nu s-a putut deschide fereastra pentru export PDF."); return; }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  const handleDelete = async () => {
    setDeleting(true);

    const { error } = await supabase
      .from("project_fundings")
      .delete()
      .eq("id", fundingId);

    if (error) {
      alert(`A apărut o eroare la ștergere: ${error.message}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/admin/alimentari");
  };

  const renderFundingIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
              {renderFundingIcon()}
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

  if (!funding) return null;

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {/* Header */}
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
            onClick={() => router.push("/admin/alimentari")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la alimentări
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
                {renderFundingIcon()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Detaliu alimentare</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  {project?.name || "—"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getFundingTypeClasses(funding.funding_type)}`}>
                    {getFundingTypeLabel(funding.funding_type)}
                  </span>
                  {project?.status && (
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getProjectStatusStyle(project.status)}`}>
                      {getProjectStatusLabel(project.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Buton sterge */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              Șterge
            </button>
          </div>

          {/* Suma mare */}
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-[20px] bg-[#0196ff] px-6 py-4">
              <p className="text-xs font-semibold text-white/70">Sumă alimentată</p>
              <p className="mt-1 text-3xl font-extrabold text-white">
                {Number(funding.amount_ron || 0).toFixed(2)} lei
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Export PDF
            </button>
          </div>
        </section>

        {/* Date proiect */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Date proiect
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Proiect</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.name || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Cod centru cost</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.cost_center_code || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Beneficiar</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.beneficiary || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Locație</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.project_location || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Șef șantier</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{teamLead?.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Alimentat de</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{adminProfile?.full_name || "-"}</p>
            </div>
          </div>
        </section>

        {/* Date alimentare */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Date alimentare
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Tip</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {getFundingTypeLabel(funding.funding_type)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Sumă</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {Number(funding.amount_ron || 0).toFixed(2)} lei
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data alimentării</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {funding.funding_date
                  ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Creată la</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {funding.created_at
                  ? new Date(funding.created_at).toLocaleDateString("ro-RO")
                  : "-"}
              </p>
            </div>
          </div>

          {funding.notes && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-3 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Observații
                </p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {funding.notes}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal confirmare stergere */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-red-600">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-extrabold text-gray-900">Șterge alimentarea</h2>
              <p className="mt-2 text-sm text-gray-500">
                Ești sigur că vrei să ștergi alimentarea de{" "}
                <span className="font-semibold text-gray-800">
                  {Number(funding.amount_ron || 0).toFixed(2)} lei
                </span>{" "}
                pentru{" "}
                <span className="font-semibold text-gray-800">{project?.name || "-"}</span>?
                Această acțiune nu poate fi anulată.
              </p>
            </div>
            <div className="flex gap-3 border-t border-[#E8E5DE] px-6 py-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Se șterge..." : "Da, șterge"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
	  return (
 <BottomNav />
    </div>
  );
}
