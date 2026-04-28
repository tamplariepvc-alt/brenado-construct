"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
};

type FundingRequest = {
  id: string;
  project_id: string;
  amount_ron: number;
  notes: string | null;
  status: string;
  created_at: string;
  project_name?: string;
};

export default function SolicitaBaniPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<FundingRequest[]>([]);
  const [userId, setUserId] = useState<string>("");

  // Form state per project (expandat)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [amountRon, setAmountRon] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) { router.push("/login"); return; }
      if (profileData.role !== "sef_echipa" && profileData.role !== "administrator") {
        router.push("/dashboard");
        return;
      }

      setUserId(user.id);

      // Proiectele la care este sef
      const { data: linkedProjects } = await supabase
        .from("project_team_leads")
        .select("project_id")
        .eq("user_id", user.id);

      const projectIds = (linkedProjects || []).map((p: any) => p.project_id);

      if (projectIds.length > 0) {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name, beneficiary, project_location")
          .in("id", projectIds)
          .order("name", { ascending: true });

        setProjects((projectsData as Project[]) || []);
      }

      // Solicitarile existente ale acestui user
      const { data: requestsData } = await supabase
        .from("funding_requests")
        .select("id, project_id, amount_ron, notes, status, created_at")
        .eq("team_lead_user_id", user.id)
        .order("created_at", { ascending: false });

      setRequests((requestsData as FundingRequest[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const requestsWithNames = requests.map((r) => ({
    ...r,
    project_name: projects.find((p) => p.id === r.project_id)?.name || "-",
  }));

  const handleOpenForm = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      setAmountRon("");
      setNotes("");
    } else {
      setExpandedProjectId(projectId);
      setAmountRon("");
      setNotes("");
    }
  };

  const handleSubmit = async (projectId: string) => {
    if (!amountRon || Number(amountRon) <= 0) {
      alert("Introdu o sumă validă.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("funding_requests").insert({
      project_id: projectId,
      team_lead_user_id: userId,
      amount_ron: Number(amountRon),
      notes: notes.trim() || null,
      status: "pending",
    });

    if (error) {
      alert(`Eroare la trimiterea solicitării: ${error.message}`);
      setSubmitting(false);
      return;
    }

    // Refresh solicitari
    const { data: requestsData } = await supabase
      .from("funding_requests")
      .select("id, project_id, amount_ron, notes, status, created_at")
      .eq("team_lead_user_id", userId)
      .order("created_at", { ascending: false });

    setRequests((requestsData as FundingRequest[]) || []);
    setExpandedProjectId(null);
    setAmountRon("");
    setNotes("");
    setSubmitting(false);
  };

  const getStatusLabel = (status: string) => {
    if (status === "pending") return "În așteptare";
    if (status === "approved") return "Aprobată";
    if (status === "rejected") return "Respinsă";
    return status;
  };

  const getStatusClasses = (status: string) => {
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "approved") return "bg-green-100 text-green-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const renderMoneyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-600 sm:h-7 sm:w-7">
      <rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="15" r="2" stroke="currentColor" strokeWidth="2" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-green-50">
              {renderMoneyIcon()}
            </div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-green-600" />
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
            <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50 sm:h-14 sm:w-14">
              {renderMoneyIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Șantierele tale</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Solicită bani
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Trimite o solicitare de alimentare card sau cont pentru șantierele tale. Administratorul va fi notificat.
              </p>
            </div>
          </div>
        </section>

        {/* Santiere */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Șantierele tale — selectează pentru a solicita
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {projects.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Nu ești asociat niciunui șantier activ.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const isExpanded = expandedProjectId === project.id;
                const projectRequests = requestsWithNames.filter((r) => r.project_id === project.id);
                const pendingCount = projectRequests.filter((r) => r.status === "pending").length;

                return (
                  <div
                    key={project.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-green-50">
                              {renderMoneyIcon()}
                            </div>
                            <div className="min-w-0">
                              <h2 className="text-base font-bold text-gray-900">{project.name}</h2>
                              <p className="mt-0.5 text-sm text-gray-500">{project.beneficiary || "-"}</p>
                              <p className="text-xs text-gray-400">{project.project_location || "-"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {pendingCount > 0 && (
                            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                              {pendingCount} în așteptare
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenForm(project.id)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                              isExpanded
                                ? "bg-gray-100 text-gray-700"
                                : "bg-green-600 text-white hover:opacity-90"
                            }`}
                          >
                            {isExpanded ? "Anulează" : "Solicită bani"}
                          </button>
                        </div>
                      </div>

                      {/* Form expandat in card */}
                      {isExpanded && (
                        <div className="mt-5 border-t border-[#E8E5DE] pt-5">
                          <div className="mb-4 flex items-center gap-3 px-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                              Detalii solicitare
                            </p>
                            <div className="h-px flex-1 bg-[#E8E5DE]" />
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-sm font-semibold text-gray-700">
                                Sumă solicitată <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={amountRon}
                                  onChange={(e) => setAmountRon(e.target.value)}
                                  placeholder="Ex: 5000"
                                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-gray-500"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                              </div>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-semibold text-gray-700">
                                Observații
                              </label>
                              <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Motivul solicitării, pentru ce sunt necesari banii..."
                                rows={3}
                                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
                              />
                            </div>

                            {Number(amountRon) > 0 && (
                              <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
                                <p className="text-sm font-medium text-green-800">
                                  Solicitare pentru <span className="font-bold">{project.name}</span>
                                </p>
                                <p className="mt-1 text-lg font-extrabold text-green-900">
                                  {Number(amountRon).toFixed(2)} lei
                                </p>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSubmit(project.id)}
                              disabled={submitting || !amountRon || Number(amountRon) <= 0}
                              className="w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                            >
                              {submitting ? "Se trimite..." : "Trimite solicitarea"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Istoricul solicitarilor pentru acest proiect */}
                    {projectRequests.length > 0 && (
                      <div className="border-t border-[#E8E5DE] bg-[#FAFAF8] px-5 py-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                          Solicitările tale anterioare
                        </p>
                        <div className="space-y-2">
                          {projectRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {Number(req.amount_ron).toFixed(2)} lei
                                </p>
                                {req.notes && (
                                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{req.notes}</p>
                                )}
                                <p className="mt-0.5 text-xs text-gray-400">
                                  {new Date(req.created_at).toLocaleDateString("ro-RO")}
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(req.status)}`}>
                                {getStatusLabel(req.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
