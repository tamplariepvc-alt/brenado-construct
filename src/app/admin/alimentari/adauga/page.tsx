"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  status: string;
};

type TeamLead = {
  id: string;
  full_name: string;
};

export default function AdaugaAlimentarePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [amountRon, setAmountRon] = useState("");
  const [fundingType, setFundingType] = useState<"card" | "cont">("card");
  const [fundingDate, setFundingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, beneficiary, status")
        .in("status", ["in_asteptare", "in_lucru"])
        .order("name", { ascending: true });

      const { data: leadsData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "sef_echipa")
        .order("full_name", { ascending: true });

      setProjects((projectsData as Project[]) || []);
      setTeamLeads((leadsData as TeamLead[]) || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const getProjectStatusLabel = (status: string) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return status;
  };

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedProjectId) {
      alert("Selectează proiectul.");
      return;
    }

    if (!amountRon || Number(amountRon) <= 0) {
      alert("Introdu o sumă validă.");
      return;
    }

    if (!fundingType) {
      alert("Selectează tipul alimentării.");
      return;
    }

    if (!fundingDate) {
      alert("Selectează data alimentării.");
      return;
    }

    if (!selectedLeadId) {
      alert("Selectează obligatoriu un șef de șantier.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("project_fundings").insert({
      project_id: selectedProjectId,
      added_by: user.id,
      team_lead_user_id: selectedLeadId,
      amount_ron: Number(amountRon),
      funding_type: fundingType,
      funding_date: fundingDate,
      notes: notes.trim() || null,
    });

    if (error) {
      alert(`A apărut o eroare la salvarea alimentării: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Alimentarea a fost salvată.");
    router.push("/admin/alimentari");
  };



  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alimentare Card / Cont</h1>
            <p className="text-sm text-gray-600">
              Adaugă o alimentare nouă pentru un proiect activ.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/alimentari")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la alimentări
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Proiect
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="">Selectează proiectul</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.beneficiary || "-"} (
                    {getProjectStatusLabel(project.status)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sumă alimentată (RON)
              </label>
              <input
                type="number"
                step="0.01"
                value={amountRon}
                onChange={(e) => setAmountRon(e.target.value)}
                placeholder="Ex: 5000"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Tip alimentare
              </label>
              <select
                value={fundingType}
                onChange={(e) =>
                  setFundingType(e.target.value as "card" | "cont")
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="card">Card</option>
                <option value="cont">Cont</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Data alimentării
              </label>
              <input
                type="date"
                value={fundingDate}
                onChange={(e) => setFundingDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Șef de șantier
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="">Selectează șeful de șantier</option>
                {teamLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Observații
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="Observații opționale..."
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-medium text-green-800">
              Sumă introdusă: {Number(amountRon || 0).toFixed(2)} lei
            </p>
            <p className="mt-1 text-sm text-green-800">
              Tip alimentare: {fundingType === "card" ? "Card" : "Cont"}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Se salvează..." : "Salvează alimentarea"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/alimentari")}
              className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunță
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}