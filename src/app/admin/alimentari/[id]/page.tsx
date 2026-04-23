"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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
          id,
          project_id,
          added_by,
          team_lead_user_id,
          amount_ron,
          funding_type,
          funding_date,
          notes,
          created_at
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
          .select(`
            id,
            name,
            beneficiary,
            project_location,
            status,
            cost_center_code
          `)
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

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const getProjectStatusStyle = (status: string) => {
    if (status === "in_asteptare") return "bg-blue-100 text-blue-800";
    if (status === "in_lucru") return "bg-yellow-100 text-yellow-800";
    if (status === "finalizat") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  const handleExportPdf = () => {
    if (!funding) return;

    const projectName = project?.name || "-";
    const costCenterCode = project?.cost_center_code || "-";
    const beneficiary = project?.beneficiary || "-";
    const projectLocation = project?.project_location || "-";
    const projectStatus = getProjectStatusLabel(project?.status || "");
    const teamLeadName = teamLead?.full_name || "-";
    const addedByName = adminProfile?.full_name || "-";
    const fundingTypeLabel = getFundingTypeLabel(funding.funding_type);
    const fundingAmount = `${Number(funding.amount_ron || 0).toFixed(2)} lei`;
    const fundingDate = funding.funding_date
      ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
      : "-";
    const createdAt = funding.created_at
      ? new Date(funding.created_at).toLocaleDateString("ro-RO")
      : "-";
    const notes = funding.notes || "-";

    const html = `
      <html>
        <head>
          <title>Detaliu alimentare</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #111827;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 8px;
            }
            .muted {
              color: #6b7280;
              margin-bottom: 18px;
            }
            .section {
              margin-top: 20px;
              padding: 16px;
              border: 1px solid #d1d5db;
              border-radius: 10px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 14px;
            }
            .row {
              margin-bottom: 12px;
            }
            .label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .value {
              font-size: 16px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <h1>Detaliu alimentare</h1>
          <div class="muted">Raport generat la ${new Date().toLocaleString("ro-RO")}</div>

          <div class="section">
            <div class="section-title">Date proiect</div>

            <div class="row">
              <div class="label">Proiect</div>
              <div class="value">${projectName}</div>
            </div>

            <div class="row">
              <div class="label">Cod centru de cost</div>
              <div class="value">${costCenterCode}</div>
            </div>

            <div class="row">
              <div class="label">Beneficiar</div>
              <div class="value">${beneficiary}</div>
            </div>

            <div class="row">
              <div class="label">Locație</div>
              <div class="value">${projectLocation}</div>
            </div>

            <div class="row">
              <div class="label">Status proiect</div>
              <div class="value">${projectStatus}</div>
            </div>

            <div class="row">
              <div class="label">Șef șantier</div>
              <div class="value">${teamLeadName}</div>
            </div>

            <div class="row">
              <div class="label">Alimentat de</div>
              <div class="value">${addedByName}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Date alimentare</div>

            <div class="row">
              <div class="label">Tip alimentare</div>
              <div class="value">${fundingTypeLabel}</div>
            </div>

            <div class="row">
              <div class="label">Sumă alimentată</div>
              <div class="value">${fundingAmount}</div>
            </div>

            <div class="row">
              <div class="label">Data alimentării</div>
              <div class="value">${fundingDate}</div>
            </div>

            <div class="row">
              <div class="label">Creată la</div>
              <div class="value">${createdAt}</div>
            </div>

            <div class="row">
              <div class="label">Observații</div>
              <div class="value">${notes}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Nu s-a putut deschide fereastra pentru export PDF.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur vrei să ștergi această alimentare?"
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("project_fundings")
      .delete()
      .eq("id", fundingId);

    if (error) {
      alert(`A apărut o eroare la ștergere: ${error.message}`);
      setDeleting(false);
      return;
    }

    alert("Alimentarea a fost ștearsă.");
    router.push("/admin/alimentari");
  };

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

  if (!funding) {
    return <div className="p-6">Alimentarea nu a fost găsită.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu alimentare</h1>
            <p className="text-sm text-gray-600">
              Vezi informațiile complete ale alimentării selectate.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin/alimentari")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Înapoi la alimentări
            </button>

            <button
              onClick={handleExportPdf}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{project?.name || "-"}</h2>
                <p className="text-sm text-gray-500">
                  Cod centru de cost: {project?.cost_center_code || "-"}
                </p>
              </div>

              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${getProjectStatusStyle(
                  project?.status || ""
                )}`}
              >
                {getProjectStatusLabel(project?.status || "")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Beneficiar</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {project?.beneficiary || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Locație</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {project?.project_location || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Șef șantier</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {teamLead?.full_name || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Alimentat de</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {adminProfile?.full_name || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Date alimentare</h2>
              <p className="mt-1 text-sm text-gray-500">
                Informațiile financiare ale alimentării.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Tip alimentare</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {getFundingTypeLabel(funding.funding_type)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Sumă alimentată</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {Number(funding.amount_ron || 0).toFixed(2)} lei
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Data alimentării</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {funding.funding_date
                    ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Creată la</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {funding.created_at
                    ? new Date(funding.created_at).toLocaleDateString("ro-RO")
                    : "-"}
                </p>
              </div>
            </div>

            {funding.notes && (
              <div className="mt-6">
                <h3 className="mb-2 text-base font-semibold">Observații</h3>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {funding.notes}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Se șterge..." : "Șterge alimentarea"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/alimentari")}
                className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
              >
                Înapoi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}