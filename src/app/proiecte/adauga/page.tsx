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
  const [dataStart, setDataStart] = useState("");
  const [termen, setTermen] = useState("");
  const [status, setStatus] = useState("in_asteptare");

  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // 🔹 Încarcă șefii de echipă
  useEffect(() => {
    const loadTeamLeads = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "sef_echipa");

      if (data) {
        setTeamLeads(data);
      }
    };

    loadTeamLeads();
  }, []);

  // 🔹 select multi
  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  // 🔹 salvare proiect
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nume || !beneficiar || !locatie) {
      alert("Completează câmpurile obligatorii");
      return;
    }

    setLoading(true);

    // 1. creează proiect
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: nume,
        beneficiary: beneficiar,
        project_location: locatie,
        project_type: tip,
        start_date: dataStart,
        execution_deadline: termen,
        status: status,
      })
      .select()
      .single();

    if (projectError || !projectData) {
      alert("Eroare la salvare proiect");
      setLoading(false);
      return;
    }

    // 2. salvează șefii de echipă
    if (selectedLeads.length > 0) {
      const rows = selectedLeads.map((userId) => ({
        project_id: projectData.id,
        user_id: userId,
      }));

      await supabase.from("project_team_leads").insert(rows);
    }

    setLoading(false);

    alert("Proiect salvat!");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="mb-6 text-2xl font-bold">Adaugă proiect</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <input
          placeholder="Nume proiect"
          value={nume}
          onChange={(e) => setNume(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        <input
          placeholder="Beneficiar"
          value={beneficiar}
          onChange={(e) => setBeneficiar(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        <input
          placeholder="Locație proiect"
          value={locatie}
          onChange={(e) => setLocatie(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        <input
          placeholder="Tip proiect"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        <input
          type="date"
          value={dataStart}
          onChange={(e) => setDataStart(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        <input
          type="date"
          value={termen}
          onChange={(e) => setTermen(e.target.value)}
          className="rounded-lg border px-4 py-3"
        />

        {/* STATUS */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border px-4 py-3"
        >
          <option value="in_asteptare">In asteptare</option>
          <option value="in_lucru">In lucru</option>
          <option value="finalizat">Finalizat</option>
        </select>

        {/* SEF ECHIPA MULTI */}
        <div className="col-span-2 rounded-lg border p-4">
          <p className="mb-2 font-semibold">Șef de echipă</p>

          {teamLeads.map((lead) => (
            <label key={lead.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLeads.includes(lead.id)}
                onChange={() => toggleLead(lead.id)}
              />
              {lead.full_name}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="col-span-2 rounded-lg bg-black px-4 py-3 text-white"
        >
          {loading ? "Se salvează..." : "Salvează proiect"}
        </button>
      </form>
    </div>
  );
}