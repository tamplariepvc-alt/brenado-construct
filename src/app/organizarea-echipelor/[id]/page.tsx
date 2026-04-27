"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type Team = {
  id: string;
  project_id: string;
  work_date: string;
  created_by?: string | null;
  created_at?: string | null;
};

type Project = {
  id: string;
  name: string;
  status: string;
  beneficiary: string | null;
  project_location: string | null;
};

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  registration_number: string;
  status: string;
  rca_valid_until: string | null;
  itp_valid_until: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type TeamVehicleRelation = {
  id?: string;
  daily_team_id: string;
  vehicle_id: string;
};

type TeamWorkerRelation = {
  id?: string;
  daily_team_id: string;
  worker_id: string;
};

export default function DetaliuEchipaPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teamVehicles, setTeamVehicles] = useState<TeamVehicleRelation[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<TeamWorkerRelation[]>([]);

  // Modal ștergere
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === "administrator";

  const parseDate = (value: string | null | undefined) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getVehicleComputedStatus = (vehicle: Vehicle) => {
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rca = parseDate(vehicle.rca_valid_until);
    const itp = parseDate(vehicle.itp_valid_until);
    if ((rca && rca < todayOnly) || (itp && itp < todayOnly)) return "doc_expirate";
    return vehicle.status;
  };

  const loadData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) { router.push("/login"); return; }

    const { data: teamData, error: teamError } = await supabase
      .from("daily_teams")
      .select("id, project_id, work_date, created_by, created_at")
      .eq("id", teamId)
      .single();

    if (teamError || !teamData) { router.push("/organizarea-echipelor"); return; }

    // Dacă e sef_echipa, verifică că are acces la această echipă
    if (profileData.role === "sef_echipa") {
      const { data: workerData } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (workerData) {
        const { data: membershipData } = await supabase
          .from("daily_team_workers")
          .select("daily_team_id")
          .eq("worker_id", workerData.id)
          .eq("daily_team_id", teamId)
          .maybeSingle();

        if (!membershipData) {
          // Nu face parte din această echipă
          router.push("/organizarea-echipelor");
          return;
        }
      } else {
        router.push("/organizarea-echipelor");
        return;
      }
    }

    const [projectsRes, vehiclesRes, workersRes, teamVehiclesRes, teamWorkersRes] =
      await Promise.all([
        supabase.from("projects").select("id, name, status, beneficiary, project_location").eq("status", "in_lucru"),
        supabase.from("vehicles").select("id, brand, model, registration_number, status, rca_valid_until, itp_valid_until").order("registration_number", { ascending: true }),
        supabase.from("workers").select("id, full_name, is_active").eq("is_active", true).eq("worker_type", "executie").order("full_name", { ascending: true }),
        supabase.from("daily_team_vehicles").select("id, daily_team_id, vehicle_id").eq("daily_team_id", teamId),
        supabase.from("daily_team_workers").select("id, daily_team_id, worker_id").eq("daily_team_id", teamId),
      ]);

    const projectsList = (projectsRes.data as Project[]) || [];

    setProfile(profileData as Profile);
    setTeam(teamData as Team);
    setProject(projectsList.find((item) => item.id === teamData.project_id) || null);
    setVehicles((vehiclesRes.data as Vehicle[]) || []);
    setWorkers((workersRes.data as Worker[]) || []);
    setTeamVehicles((teamVehiclesRes.data as TeamVehicleRelation[]) || []);
    setTeamWorkers((teamWorkersRes.data as TeamWorkerRelation[]) || []);

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [teamId]);

  const currentTeamVehicleIds = teamVehicles.map((item) => item.vehicle_id);
  const currentTeamWorkerIds = teamWorkers.map((item) => item.worker_id);
  const currentVehicles = vehicles.filter((v) => currentTeamVehicleIds.includes(v.id));
  const currentWorkers = workers.filter((w) => currentTeamWorkerIds.includes(w.id));

  const handleExportPdf = async () => {
    if (!team || !project) return;

    const doc = new jsPDF("p", "mm", "a4");

    try {
      const logo = new window.Image();
      logo.src = "/logo.png";
      await new Promise((resolve) => { logo.onload = resolve; logo.onerror = resolve; });
      doc.addImage(logo, "PNG", 14, 10, 42, 13);
    } catch {}

    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.6);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(17);
    doc.setTextColor(30, 64, 175);
    doc.text(`Echipa – ${project.name}`, 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Beneficiar: ${project.beneficiary || "-"}`, 14, 45);
    doc.text(`Locatie: ${project.project_location || "-"}`, 14, 50);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 55);

    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(`Auto atribuite (${currentVehicles.length})`, 14, 65);

    autoTable(doc, {
      startY: 69,
      head: [["Nr.", "Înmatriculare", "Vehicul", "RCA pana la", "ITP pana la"]],
      body: currentVehicles.length > 0
        ? currentVehicles.map((v, i) => [
            String(i + 1), v.registration_number, `${v.brand} ${v.model}`,
            v.rca_valid_until ? new Date(`${v.rca_valid_until}T00:00:00`).toLocaleDateString("ro-RO") : "-",
            v.itp_valid_until ? new Date(`${v.itp_valid_until}T00:00:00`).toLocaleDateString("ro-RO") : "-",
          ])
        : [["", "Nu exista auto atribuite.", "", "", ""]],
      styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: "grid",
    });

    const afterVehicles = (doc as any).lastAutoTable.finalY + 8;

    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(`Personal de executie (${currentWorkers.length})`, 14, afterVehicles);

    autoTable(doc, {
      startY: afterVehicles + 4,
      head: [["Nr.", "Nume complet"]],
      body: currentWorkers.length > 0
        ? currentWorkers.map((w, i) => [String(i + 1), w.full_name])
        : [["", "Nu exista muncitori in echipa."]],
      styles: { fontSize: 9, cellPadding: 3, lineColor: [210, 210, 210], lineWidth: 0.2 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: "grid",
    });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);

    doc.save(`echipa_${project.name.replace(/\s+/g, "_")}.pdf`);
  };

  const handleDeleteTeam = async () => {
    if (deletePassword !== "brenado***") {
      setDeletePasswordError("Parolă incorectă. Încearcă din nou.");
      return;
    }

    setDeleting(true);

    await supabase.from("daily_team_workers").delete().eq("daily_team_id", teamId);
    await supabase.from("daily_team_vehicles").delete().eq("daily_team_id", teamId);
    const { error } = await supabase.from("daily_teams").delete().eq("id", teamId);

    if (error) {
      alert(`Eroare la ștergerea echipei: ${error.message}`);
      setDeleting(false);
      return;
    }

    router.push("/organizarea-echipelor");
  };

  const renderTeamIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 18c0-2.8 2.4-5 5.5-5s5.5 2.2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.5 18c.2-1.8 1.8-3.2 4-3.2 1 0 2 .2 2.8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderTeamIcon()}</div>
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

  if (!team) return null;

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => router.push("/organizarea-echipelor")}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-4"
            >
              Înapoi
            </button>
            {/* Export PDF — vizibil pentru toți */}
            <button
              onClick={handleExportPdf}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-4"
            >
              Export PDF
            </button>
            {/* Fără buton Editează — mutat pe pagina principală */}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderTeamIcon()}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Detaliu echipă</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                {project?.name || "Echipă"}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Echipă permanentă · valabilă zilnic
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Beneficiar</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.beneficiary || "-"}</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Locație</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{project?.project_location || "-"}</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Muncitori</p>
              <p className="mt-1 text-2xl font-extrabold text-gray-900">{currentWorkers.length}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Auto atribuite — {currentVehicles.length}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>
          {currentVehicles.length === 0 ? (
            <p className="text-sm text-gray-500">Nu există auto atribuite.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {currentVehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-2xl border border-gray-200 bg-[#F8F7F3] px-4 py-3">
                  <p className="text-sm font-bold text-gray-900">{vehicle.registration_number}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{vehicle.brand} {vehicle.model}</p>
                  <div className="mt-2 flex gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">RCA</p>
                      <p className="text-xs font-medium text-gray-700">
                        {vehicle.rca_valid_until ? new Date(`${vehicle.rca_valid_until}T00:00:00`).toLocaleDateString("ro-RO") : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">ITP</p>
                      <p className="text-xs font-medium text-gray-700">
                        {vehicle.itp_valid_until ? new Date(`${vehicle.itp_valid_until}T00:00:00`).toLocaleDateString("ro-RO") : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Personal de execuție — {currentWorkers.length}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>
          {currentWorkers.length === 0 ? (
            <p className="text-sm text-gray-500">Nu există muncitori în echipă.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {currentWorkers.map((worker, index) => (
                <div key={worker.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#F8F7F3] px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-500 shadow-sm">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-gray-800">{worker.full_name}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Buton Șterge — doar admin, jos în pagină */}
        {isAdmin && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeletePassword("");
                setDeletePasswordError("");
              }}
              className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto"
            >
              Șterge echipa
            </button>
          </div>
        )}
      </main>

      {/* MODAL CONFIRMARE ȘTERGERE CU PAROLĂ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-600" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h3 className="text-center text-lg font-bold text-gray-900">Ștergi această echipă?</h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                Acțiunea este ireversibilă. Echipa și toate relațiile sale vor fi șterse definitiv.
              </p>

              {project && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">{project.name}</p>
                  <p className="mt-1 text-xs text-red-600">
                    {currentWorkers.length} muncitori · {currentVehicles.length} auto
                  </p>
                </div>
              )}

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Introdu parola de confirmare
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeletePasswordError("");
                  }}
                  placeholder="Parolă de ștergere"
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                    deletePasswordError ? "border-red-400 bg-red-50" : "border-gray-300 focus:border-gray-500"
                  }`}
                />
                {deletePasswordError && (
                  <p className="mt-2 text-xs font-medium text-red-600">{deletePasswordError}</p>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDeleteTeam}
                  disabled={deleting || !deletePassword}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? "Se șterge..." : "Confirmă ștergerea"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeletePasswordError(""); }}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
