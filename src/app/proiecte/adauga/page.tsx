"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TeamLead = {
  id: string;
  full_name: string;
};

export default function AdaugaProiectPage() {
  const router = useRouter();

  const [nume, setNume] = useState("");
  const [beneficiar, setBeneficiar] = useState("");
  const [locatie, setLocatie] = useState("");
  const [tip, setTip] = useState("");
  const [grupa, setGrupa] = useState("");
  const [dataStart, setDataStart] = useState("");
  const [termen, setTermen] = useState("");
  const [status, setStatus] = useState("in_asteptare");

  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showTeamLeadsDropdown, setShowTeamLeadsDropdown] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTeamLeads = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "sef_echipa")
        .order("full_name", { ascending: true });

      if (!error && data) {
        setTeamLeads(data);
      }
    };

    loadTeamLeads();
  }, []);

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !nume.trim() ||
      !beneficiar.trim() ||
      !locatie.trim() ||
      !tip.trim() ||
      !grupa ||
      !dataStart ||
      !termen ||
      !status
    ) {
      alert("Completează toate câmpurile obligatorii.");
      return;
    }

    if (selectedLeads.length === 0) {
      alert("Selectează cel puțin un șef de echipă.");
      return;
    }

    setLoading(true);

const { count } = await supabase
  .from("projects")
  .select("*", { count: "exact", head: true });

const nextCostCenterCode = `CC-${String((count || 0) + 1).padStart(4, "0")}`;

const { data: projectData, error: projectError } = await supabase
  .from("projects")
  .insert({
    name: nume,
    beneficiary: beneficiar,
    project_location: locatie,
    project_type: tip,
    project_group: grupa,
    start_date: dataStart,
    execution_deadline: termen,
    status,
    is_cost_center: true,
    cost_center_code: nextCostCenterCode,
  })
  .select()
  .single();

    if (projectError || !projectData) {
      alert("A apărut o eroare la salvarea proiectului.");
      setLoading(false);
      return;
    }

    const rows = selectedLeads.map((userId) => ({
      project_id: projectData.id,
      user_id: userId,
    }));

    const { error: leadsError } = await supabase
      .from("project_team_leads")
      .insert(rows);

    if (leadsError) {
      alert("Proiectul a fost creat, dar șefii de echipă nu au putut fi salvați.");
      setLoading(false);
      return;
    }

    setLoading(false);
    alert("Proiect salvat cu succes.");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Adaugă proiect</h1>
            <p className="text-sm text-gray-600">
              Completează datele proiectului și selectează șefii de echipă.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Înapoi la dashboard
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Informații proiect</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Nume proiect *
                </label>
                <input
                  type="text"
                  value={nume}
                  onChange={(e) => setNume(e.target.value)}
                  placeholder="Introdu numele proiectului"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Beneficiar *
                </label>
                <input
                  type="text"
                  value={beneficiar}
                  onChange={(e) => setBeneficiar(e.target.value)}
                  placeholder="Introdu beneficiarul"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Locație proiect *
                </label>
                <input
                  type="text"
                  value={locatie}
                  onChange={(e) => setLocatie(e.target.value)}
                  placeholder="Introdu locația proiectului"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tip proiect *
                </label>
                <input
                  type="text"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  placeholder="Introdu tipul proiectului"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Selectează grupa *
                </label>
                <select
                  value={grupa}
                  onChange={(e) => setGrupa(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  <option value="">Selectează grupa</option>
                  <option value="brenado_construct">BRENADO CONSTRUCT</option>
                  <option value="brenado_mentenanta">BRENADO MENTENANȚĂ</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Planificare și status</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data de început *
                </label>
                <input
                  type="date"
                  value={dataStart}
                  onChange={(e) => setDataStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Termen de execuție *
                </label>
                <input
                  type="date"
                  value={termen}
                  onChange={(e) => setTermen(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status proiect *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  <option value="in_asteptare">În așteptare</option>
                  <option value="in_lucru">În lucru</option>
                  <option value="finalizat">Finalizat</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="text-2xl font-bold">Șefi de echipă</h2>
            <p className="mt-3 text-base text-gray-600">
              Selectează minim un șef de echipă pentru proiect.
            </p>

            <div className="relative mt-5">
              <button
                type="button"
                onClick={() => setShowTeamLeadsDropdown((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-5 py-4 text-left text-lg text-gray-800"
              >
                <span>
                  {selectedLeads.length > 0
                    ? `Selectați: ${selectedLeads.length}`
                    : "Selectează șefii de echipă"}
                </span>
                <span className="text-xl">{showTeamLeadsDropdown ? "▲" : "▼"}</span>
              </button>

              {showTeamLeadsDropdown && (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-300 bg-white p-3 shadow-lg">
                  {teamLeads.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-gray-500">
                      Nu există utilizatori cu rol de șef de echipă.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {teamLeads.map((lead) => (
                        <label
                          key={lead.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                            className="h-5 w-5"
                          />
                          <span className="text-base text-gray-800">
                            {lead.full_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedLeads.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {teamLeads
                  .filter((lead) => selectedLeads.includes(lead.id))
                  .map((lead) => (
                    <span
                      key={lead.id}
                      className="rounded-full bg-[#0196ff]/10 px-3 py-2 text-sm font-medium text-[#0196ff]"
                    >
                      {lead.full_name}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Se salvează..." : "Salvează proiect"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunță
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}