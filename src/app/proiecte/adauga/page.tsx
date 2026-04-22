"use client";

import Image from "next/image";
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
  const [bugetRon, setBugetRon] = useState("");
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

    if (bugetRon && Number(bugetRon) < 0) {
      alert("Bugetul nu poate fi negativ.");
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
        name: nume.trim(),
        beneficiary: beneficiar.trim(),
        project_location: locatie.trim(),
        project_type: tip.trim(),
        project_group: grupa,
        budget_ron: bugetRon ? Number(bugetRon) : null,
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

  const renderProjectIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="4"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="10"
        width="7"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );

  const renderTeamIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 18c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 18c.2-1.8 1.8-3.2 4-3.2 1.1 0 2.1.3 2.9.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

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
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderProjectIcon()}
            </div>

            <div>
              <p className="text-sm text-gray-500">Administrare proiecte</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Adaugă proiect
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Completează datele proiectului și selectează șefii de echipă.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-blue-50">
                {renderProjectIcon()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Informații proiect
                </h2>
                <p className="text-sm text-gray-500">
                  Datele generale ale proiectului.
                </p>
              </div>
            </div>

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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Selectează grupa *
                </label>
                <select
                  value={grupa}
                  onChange={(e) => setGrupa(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                >
                  <option value="">Selectează grupa</option>
                  <option value="brenado_construct">BRENADO CONSTRUCT</option>
                  <option value="brenado_mentenanta">BRENADO MENTENANȚĂ</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Buget (RON)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={bugetRon}
                  onChange={(e) => setBugetRon(e.target.value)}
                  placeholder="Introdu bugetul proiectului"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Planificare și status
              </h2>
              <p className="text-sm text-gray-500">
                Setează perioada și starea inițială a proiectului.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data de început *
                </label>
                <input
                  type="date"
                  value={dataStart}
                  onChange={(e) => setDataStart(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status proiect *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                >
                  <option value="in_asteptare">În așteptare</option>
                  <option value="in_lucru">În lucru</option>
                  <option value="finalizat">Finalizat</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-blue-50">
                {renderTeamIcon()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Șefi de echipă
                </h2>
                <p className="text-sm text-gray-500">
                  Selectează minim un șef de echipă pentru proiect.
                </p>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTeamLeadsDropdown((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-5 py-4 text-left text-base text-gray-800 transition hover:bg-gray-50"
              >
                <span>
                  {selectedLeads.length > 0
                    ? `Selectați: ${selectedLeads.length}`
                    : "Selectează șefii de echipă"}
                </span>
                <span className="text-lg">{showTeamLeadsDropdown ? "▲" : "▼"}</span>
              </button>

              {showTeamLeadsDropdown && (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-300 bg-white p-3 shadow-lg">
                  {teamLeads.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-gray-500">
                      Nu există utilizatori cu rol de șef de echipă.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {teamLeads.map((lead) => (
                        <label
                          key={lead.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-gray-50"
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
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Se salvează..." : "Salvează proiect"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Renunță
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}