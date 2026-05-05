"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { createNotification } from "@/lib/notifications";

type Project = { id: string; name: string; beneficiary: string | null; status: string; };
type TeamLead = { id: string; full_name: string; };

function AdaugaAlimentareInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [amountRon, setAmountRon] = useState("");
  const [fundingDate, setFundingDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [notes, setNotes] = useState("");

  const fromRequestId = searchParams.get("from_request");
  const isFromRequest = Boolean(fromRequestId);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: projectsData } = await supabase.from("projects").select("id, name, beneficiary, status").in("status", ["in_asteptare", "in_lucru"]).order("name", { ascending: true });
      const { data: leadsData } = await supabase.from("profiles").select("id, full_name").eq("role", "sef_echipa").order("full_name", { ascending: true });
      setProjects((projectsData as Project[]) || []);
      setTeamLeads((leadsData as TeamLead[]) || []);
      const qProject = searchParams.get("project_id");
      const qAmount = searchParams.get("amount");
      const qLead = searchParams.get("lead_id");
      const qNotes = searchParams.get("notes");
      if (qProject) setSelectedProjectId(qProject);
      if (qAmount) setAmountRon(qAmount);
      if (qLead) setSelectedLeadId(qLead);
      if (qNotes) setNotes(decodeURIComponent(qNotes));
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    if (!selectedProjectId) { alert("Selectează proiectul."); return; }
    if (!amountRon || Number(amountRon) <= 0) { alert("Introdu o sumă validă."); return; }
    if (!fundingDate) { alert("Selectează data alimentării."); return; }
    if (isFromRequest && !selectedLeadId) { alert("Selectează șeful de șantier."); return; }

    setSaving(true);

    const { error } = await supabase.from("project_fundings").insert({
      project_id: selectedProjectId,
      added_by: user.id,
      team_lead_user_id: selectedLeadId || null,
      amount_ron: Number(amountRon),
      funding_type: "card",
      funding_date: fundingDate,
      notes: notes.trim() || null,
    });

    if (error) { alert(`A apărut o eroare la salvarea alimentării: ${error.message}`); setSaving(false); return; }

    // Notificare catre sef_echipa
    const projectName = projects.find((p) => p.id === selectedProjectId)?.name || "-";
    const amount = Number(amountRon).toFixed(2);

    if (fromRequestId) {
      // Aprobare solicitare → notif "solicitarea aprobata"
      await supabase.from("funding_requests").update({ status: "approved" }).eq("id", fromRequestId);
      await createNotification({
        user_id: selectedLeadId,
        title: "Solicitare aprobată",
        message: `Solicitarea ta de transfer în valoare de ${amount} lei a fost aprobată pentru șantierul ${projectName}.`,
        type: "success",
        link: "/solicita-bani",
      });
    } else {
      // Alimentare directa → notif "au fost adaugati bani" (doar daca s-a selectat sef)
      if (selectedLeadId) {
        await createNotification({
          user_id: selectedLeadId,
          title: "Alimentare card",
          message: `Au fost adăugați ${amount} lei în contul tău pentru șantierul ${projectName}.`,
          type: "success",
          link: undefined,
        });
      }
    }

    setSaving(false);
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderFundingIcon()}</div>
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
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/admin/alimentari")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la alimentări
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">{renderFundingIcon()}</div>
            <div>
              <p className="text-sm text-gray-500">Administrare alimentări</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                {isFromRequest ? "Aprobă solicitare" : "Alimentare card"}
              </h1>
              <p className="mt-3 text-sm text-gray-500 sm:text-base">
                {isFromRequest ? "Datele sunt precompletate din solicitarea șefului de echipă." : "Adaugă o alimentare pe card pentru un proiect activ."}
              </p>
            </div>
          </div>
          {isFromRequest && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">Verifică datele și data alimentării, apoi salvează pentru a aproba solicitarea.</p>
            </div>
          )}
        </section>

        <div className="mt-6 space-y-4">
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">{isFromRequest ? "Proiect & șef" : "Proiect"}</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Proiect <span className="text-red-500">*</span></label>
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
                  <option value="">Selectează proiectul</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.beneficiary ? ` — ${p.beneficiary}` : ""}</option>)}
                </select>
              </div>
              {isFromRequest && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Șef de șantier <span className="text-red-500">*</span></label>
                  <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
                    <option value="">Selectează șeful de șantier</option>
                    {teamLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Detalii alimentare</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Sumă <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type="text" inputMode="decimal" value={amountRon}
                    onBlur={(e) => setAmountRon(e.target.value)}
                    onChange={(e) => setAmountRon(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-gray-500" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Data alimentării</label>
                <input type="date" value={fundingDate} onChange={(e) => setFundingDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
              </div>
            </div>
            {/* Tip alimentare — doar card, afisare informativa */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">Tip alimentare</label>
              <div className="inline-flex rounded-2xl border border-green-500 bg-green-50 px-5 py-2.5">
                <span className="text-sm font-semibold text-green-700">Card</span>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Observații</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Observații opționale..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
          </section>

          {Number(amountRon) > 0 && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-700">Card — {projects.find((p) => p.id === selectedProjectId)?.name || "șantier neselectat"}</p>
              <p className="mt-1 text-2xl font-extrabold text-gray-900">{Number(amountRon).toFixed(2)} lei</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleSave} disabled={saving}
              className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
              {saving ? "Se salvează..." : isFromRequest ? "Aprobă & salvează alimentarea" : "Salvează alimentarea"}
            </button>
            <button type="button" onClick={() => router.push("/admin/alimentari")}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto">
              Renunță
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdaugaAlimentarePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
        </div>
      </div>
    }>
      <AdaugaAlimentareInner />
    </Suspense>
  );
}
