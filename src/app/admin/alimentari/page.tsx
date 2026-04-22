"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type FundingBaseRow = {
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

type ProjectMapRow = {
  id: string;
  name: string;
  beneficiary: string | null;
};

type ProfileMapRow = {
  id: string;
  full_name: string;
};

type FundingRow = FundingBaseRow & {
  project_name: string;
  project_beneficiary: string | null;
  team_lead_name: string;
  added_by_name: string;
};

export default function AlimentariPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fundings, setFundings] = useState<FundingRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
        .order("funding_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fundingError || !fundingData) {
        setFundings([]);
        setLoading(false);
        return;
      }

      const baseRows = fundingData as FundingBaseRow[];

      const projectIds = Array.from(
        new Set(baseRows.map((row) => row.project_id).filter(Boolean))
      );

      const profileIds = Array.from(
        new Set(
          baseRows
            .flatMap((row) => [row.team_lead_user_id, row.added_by])
            .filter(Boolean)
        )
      );

      const [projectsRes, profilesRes] = await Promise.all([
        projectIds.length > 0
          ? supabase
              .from("projects")
              .select("id, name, beneficiary")
              .in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const projects = (projectsRes.data || []) as ProjectMapRow[];
      const profiles = (profilesRes.data || []) as ProfileMapRow[];

      const projectMap = new Map<string, ProjectMapRow>();
      projects.forEach((project) => {
        projectMap.set(project.id, project);
      });

      const profileMap = new Map<string, ProfileMapRow>();
      profiles.forEach((profile) => {
        profileMap.set(profile.id, profile);
      });

      const formattedRows: FundingRow[] = baseRows.map((row) => {
        const project = projectMap.get(row.project_id);
        const teamLead = profileMap.get(row.team_lead_user_id);
        const addedBy = profileMap.get(row.added_by);

        return {
          ...row,
          project_name: project?.name || "-",
          project_beneficiary: project?.beneficiary || "-",
          team_lead_name: teamLead?.full_name || "-",
          added_by_name: addedBy?.full_name || "-",
        };
      });

      setFundings(formattedRows);
      setLoading(false);
    };

    loadData();
  }, []);

  const filteredFundings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    if (!q) return fundings;

    return fundings.filter((funding) => {
      const amountText = Number(funding.amount_ron || 0).toFixed(2);
      const amountTextNoDecimals = String(Number(funding.amount_ron || 0));

      return (
        funding.project_name.toLowerCase().includes(q) ||
        (funding.project_beneficiary || "").toLowerCase().includes(q) ||
        funding.team_lead_name.toLowerCase().includes(q) ||
        funding.added_by_name.toLowerCase().includes(q) ||
        getFundingTypeLabel(funding.funding_type).toLowerCase().includes(q) ||
        amountText.includes(q) ||
        amountTextNoDecimals.includes(q)
      );
    });
  }, [fundings, searchTerm]);

  const totals = useMemo(() => {
    return filteredFundings.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.total += Number(row.amount_ron || 0);
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [filteredFundings]);

  const getFundingTypeLabel = (type: string) => {
    if (type === "card") return "Card";
    if (type === "cont") return "Cont";
    return type;
  };

  const getFundingTypeClasses = (type: string) => {
    if (type === "card") {
      return "bg-green-100 text-green-700";
    }

    if (type === "cont") {
      return "bg-blue-100 text-blue-700";
    }

    return "bg-gray-100 text-gray-700";
  };

  const handleExportPdf = () => {
    const rowsHtml = filteredFundings
      .map((funding, index) => {
        const dateText = funding.funding_date
          ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
          : "-";

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${funding.project_name}</td>
            <td>${funding.project_beneficiary || "-"}</td>
            <td>${funding.team_lead_name}</td>
            <td>${funding.added_by_name}</td>
            <td>${getFundingTypeLabel(funding.funding_type)}</td>
            <td>${Number(funding.amount_ron || 0).toFixed(2)} lei</td>
            <td>${dateText}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>Raport alimentări</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #111827;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 6px;
            }
            p {
              margin-top: 0;
              margin-bottom: 16px;
              color: #4b5563;
            }
            .summary {
              margin-bottom: 20px;
              padding: 12px;
              border: 1px solid #d1d5db;
              border-radius: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 10px;
              text-align: left;
              font-size: 12px;
              vertical-align: top;
            }
            th {
              background: #f3f4f6;
            }
          </style>
        </head>
        <body>
          <h1>Raport alimentări carduri / conturi</h1>
          <p>Generat la ${new Date().toLocaleString("ro-RO")}</p>

          <div class="summary">
            <strong>Total alimentări:</strong> ${totals.count}<br />
            <strong>Valoare totală alimentată:</strong> ${totals.total.toFixed(2)} lei
          </div>

          <table>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Proiect</th>
                <th>Beneficiar</th>
                <th>Șef șantier</th>
                <th>Alimentat de</th>
                <th>Tip</th>
                <th>Sumă</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="8">Nu există alimentări pentru export.</td></tr>`}
            </tbody>
          </table>
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

  if (loading) {
    return <div className="p-6">Se încarcă alimentările...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alimentare Carduri / Conturi</h1>
            <p className="text-sm text-gray-600">
              Gestionează alimentările proiectelor și istoricul lor.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Înapoi la panou admin
            </button>

            <button
              onClick={() => router.push("/admin/alimentari/adauga")}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Alimentare Card / Cont
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total alimentări
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totals.count}
            </p>
          </div>

          <div className="rounded-2xl bg-[#0196ff] p-4 text-white shadow">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">
              Valoare totală alimentată
            </p>
            <p className="mt-2 text-2xl font-bold">
              {totals.total.toFixed(2)} lei
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              placeholder="Caută după șantier, șef de echipă, alimentat de sau valoare"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />

            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white whitespace-nowrap"
            >
              Export PDF
            </button>
          </div>
        </div>

        {filteredFundings.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-6 shadow">
            <p className="text-sm text-gray-500">
              Nu există alimentări pentru criteriul introdus.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFundings.map((funding) => (
              <div
                key={funding.id}
                className="rounded-2xl bg-white p-4 shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-gray-900">
                      {funding.project_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {funding.project_beneficiary || "-"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold text-gray-900">
                      {Number(funding.amount_ron || 0).toFixed(2)} lei
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getFundingTypeClasses(
                        funding.funding_type
                      )}`}
                    >
                      {getFundingTypeLabel(funding.funding_type)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium text-gray-500">
                      Șef șantier:
                    </span>{" "}
                    {funding.team_lead_name}
                  </p>

                  <p>
                    <span className="font-medium text-gray-500">
                      Alimentat de:
                    </span>{" "}
                    {funding.added_by_name}
                  </p>

                  <p>
                    <span className="font-medium text-gray-500">Data:</span>{" "}
                    {funding.funding_date
                      ? new Date(funding.funding_date).toLocaleDateString(
                          "ro-RO"
                        )
                      : "-"}
                  </p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/alimentari/${funding.id}`)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Vezi detalii
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}