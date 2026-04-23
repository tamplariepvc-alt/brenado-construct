"use client";

import Image from "next/image";
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
          ? supabase.from("projects").select("id, name, beneficiary").in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const projects = (projectsRes.data || []) as ProjectMapRow[];
      const profiles = (profilesRes.data || []) as ProfileMapRow[];

      const projectMap = new Map<string, ProjectMapRow>();
      projects.forEach((p) => projectMap.set(p.id, p));

      const profileMap = new Map<string, ProfileMapRow>();
      profiles.forEach((p) => profileMap.set(p.id, p));

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
      const amount = Number(funding.amount_ron || 0);
      return (
        funding.project_name.toLowerCase().includes(q) ||
        (funding.project_beneficiary || "").toLowerCase().includes(q) ||
        funding.team_lead_name.toLowerCase().includes(q) ||
        funding.added_by_name.toLowerCase().includes(q) ||
        getFundingTypeLabel(funding.funding_type).toLowerCase().includes(q) ||
        amount.toFixed(2).includes(q) ||
        String(amount).includes(q)
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

  const cardTotal = useMemo(
    () => filteredFundings.filter((f) => f.funding_type === "card")
        .reduce((s, f) => s + Number(f.amount_ron || 0), 0),
    [filteredFundings]
  );

  const contTotal = useMemo(
    () => filteredFundings.filter((f) => f.funding_type === "cont")
        .reduce((s, f) => s + Number(f.amount_ron || 0), 0),
    [filteredFundings]
  );

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
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 6px; }
            p { margin-top: 0; margin-bottom: 16px; color: #4b5563; }
            .summary { margin-bottom: 20px; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; vertical-align: top; }
            th { background: #f3f4f6; }
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
                <th>Nr.</th><th>Proiect</th><th>Beneficiar</th>
                <th>Șef șantier</th><th>Alimentat de</th>
                <th>Tip</th><th>Sumă</th><th>Data</th>
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
    if (!printWindow) { alert("Nu s-a putut deschide fereastra pentru export PDF."); return; }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
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
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la admin
            </button>
            <button
              onClick={() => router.push("/admin/alimentari/adauga")}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Alimentare
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderFundingIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Alimentări carduri & conturi
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Gestionează alimentările proiectelor și istoricul lor.
              </p>
            </div>
          </div>

          {/* Search + Export */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Caută după șantier, șef de echipă, alimentat de, tip sau valoare..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />
            <button
              type="button"
              onClick={handleExportPdf}
              className="shrink-0 rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Export PDF
            </button>
          </div>
        </section>

        {/* Sumar */}
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Total alimentări
            </p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{totals.count}</p>
          </div>

          <div className="rounded-[20px] bg-[#0196ff] p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              Valoare totală
            </p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {totals.total.toFixed(2)} lei
            </p>
          </div>

          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Total card
            </p>
            <p className="mt-1 text-2xl font-extrabold text-green-700">
              {cardTotal.toFixed(2)} lei
            </p>
          </div>

          <div className="rounded-[20px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Total cont
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#0196ff]">
              {contTotal.toFixed(2)} lei
            </p>
          </div>
        </section>

        {/* Lista */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista alimentări — {filteredFundings.length} înregistrări
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredFundings.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există alimentări pentru criteriul introdus.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b border-[#E8E5DE] bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-3">Șantier</div>
                  <div className="col-span-2">Șef șantier</div>
                  <div className="col-span-2">Alimentat de</div>
                  <div className="col-span-1">Tip</div>
                  <div className="col-span-2">Sumă</div>
                  <div className="col-span-1">Data</div>
                  <div className="col-span-1"></div>
                </div>

                {filteredFundings.map((funding) => (
                  <button
                    key={funding.id}
                    onClick={() => router.push(`/admin/alimentari/${funding.id}`)}
                    className="grid w-full grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 text-left transition hover:bg-[#FCFBF8] last:border-b-0"
                  >
                    <div className="col-span-3">
                      <p className="text-sm font-semibold text-gray-900">{funding.project_name}</p>
                      <p className="text-xs text-gray-400">{funding.project_beneficiary || "-"}</p>
                    </div>
                    <div className="col-span-2 text-sm text-gray-600">{funding.team_lead_name}</div>
                    <div className="col-span-2 text-sm text-gray-600">{funding.added_by_name}</div>
                    <div className="col-span-1">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getFundingTypeClasses(funding.funding_type)}`}>
                        {getFundingTypeLabel(funding.funding_type)}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm font-bold text-gray-900">
                      {Number(funding.amount_ron || 0).toFixed(2)} lei
                    </div>
                    <div className="col-span-1 text-sm text-gray-500">
                      {funding.funding_date
                        ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
                        : "-"}
                    </div>
                    <div className="col-span-1 text-right text-2xl font-light text-gray-400">›</div>
                  </button>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {filteredFundings.map((funding) => (
                  <button
                    key={funding.id}
                    onClick={() => router.push(`/admin/alimentari/${funding.id}`)}
                    className="relative w-full overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderFundingIcon()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900">
                              {funding.project_name}
                            </p>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {funding.project_beneficiary || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <p className="text-base font-bold text-gray-900">
                          {Number(funding.amount_ron || 0).toFixed(2)} lei
                        </p>
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getFundingTypeClasses(funding.funding_type)}`}>
                          {getFundingTypeLabel(funding.funding_type)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 pr-8">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Șef șantier</p>
                        <p className="mt-1 text-sm text-gray-700">{funding.team_lead_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Alimentat de</p>
                        <p className="mt-1 text-sm text-gray-700">{funding.added_by_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data</p>
                        <p className="mt-1 text-sm text-gray-700">
                          {funding.funding_date
                            ? new Date(funding.funding_date).toLocaleDateString("ro-RO")
                            : "-"}
                        </p>
                      </div>
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
