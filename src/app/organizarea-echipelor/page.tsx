"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function OrganizareaEchipelorPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teamVehicles, setTeamVehicles] = useState<TeamVehicleRelation[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<TeamWorkerRelation[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  // Modal ștergere echipă
  const [deleteConfirmTeamId, setDeleteConfirmTeamId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Modal transfer personal
  const [transferModal, setTransferModal] = useState<{
    workerId: string;
    workerName: string;
    fromTeamId: string;
  } | null>(null);
  const [transferTargetTeamId, setTransferTargetTeamId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const isAdmin = profile?.role === "administrator";

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const resetForm = () => {
    setSelectedProjectId("");
    setSelectedVehicleIds([]);
    setSelectedWorkerIds([]);
    setEditingTeamId(null);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

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

    const role = profileData.role as Role;
    setProfile(profileData as Profile);

    const [projectsRes, vehiclesRes, workersRes, teamVehiclesRes, teamWorkersRes] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, beneficiary, project_location")
          .eq("status", "in_lucru")
          .order("name", { ascending: true }),
        supabase
          .from("vehicles")
          .select("id, brand, model, registration_number, status, rca_valid_until, itp_valid_until")
          .order("registration_number", { ascending: true }),
        supabase
          .from("workers")
          .select("id, full_name, is_active")
          .eq("is_active", true)
          .eq("worker_type", "executie")
          .order("full_name", { ascending: true }),
        supabase.from("daily_team_vehicles").select("id, daily_team_id, vehicle_id"),
        supabase.from("daily_team_workers").select("id, daily_team_id, worker_id"),
      ]);

    setProjects((projectsRes.data as Project[]) || []);
    setVehicles((vehiclesRes.data as Vehicle[]) || []);
    setWorkers((workersRes.data as Worker[]) || []);
    setTeamVehicles((teamVehiclesRes.data as TeamVehicleRelation[]) || []);
    setTeamWorkers((teamWorkersRes.data as TeamWorkerRelation[]) || []);

    if (role === "administrator") {
      // Admin vede toate echipele
      const { data: teamsData } = await supabase
        .from("daily_teams")
        .select("id, project_id, work_date, created_by, created_at")
        .order("created_at", { ascending: true });

      setTeams((teamsData as Team[]) || []);
    } else if (role === "sef_echipa") {
      // Găsim workerul asociat acestui user (via user_id)
      const { data: workerData } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!workerData) {
        // Nu e asociat niciunui worker — nu vede echipe
        setTeams([]);
        setLoading(false);
        return;
      }

      // Găsim echipa în care e inclus acest worker
      const { data: teamWorkerData } = await supabase
        .from("daily_team_workers")
        .select("daily_team_id")
        .eq("worker_id", workerData.id)
        .maybeSingle();

      if (!teamWorkerData) {
        setTeams([]);
        setLoading(false);
        return;
      }

      const { data: teamData } = await supabase
        .from("daily_teams")
        .select("id, project_id, work_date, created_by, created_at")
        .eq("id", teamWorkerData.daily_team_id)
        .single();

      setTeams(teamData ? [teamData as Team] : []);
    } else {
      router.push("/dashboard");
      return;
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const usedProjectIds = useMemo(() =>
    teams.filter((t) => t.id !== editingTeamId).map((t) => t.project_id),
    [teams, editingTeamId]
  );

  const usedWorkerIds = useMemo(() =>
    teamWorkers
      .filter((item) => teams.some((t) => t.id === item.daily_team_id && t.id !== editingTeamId))
      .map((item) => item.worker_id),
    [teamWorkers, teams, editingTeamId]
  );

  const usedVehicleIds = useMemo(() =>
    teamVehicles
      .filter((item) => teams.some((t) => t.id === item.daily_team_id && t.id !== editingTeamId))
      .map((item) => item.vehicle_id),
    [teamVehicles, teams, editingTeamId]
  );

  const availableProjects = useMemo(() =>
    projects.filter((project) => {
      if (editingTeamId && project.id === selectedProjectId) return true;
      return !usedProjectIds.includes(project.id);
    }),
    [projects, usedProjectIds, editingTeamId, selectedProjectId]
  );

  const availableVehicles = useMemo(() =>
    vehicles
      .filter((vehicle) => getVehicleComputedStatus(vehicle) !== "doc_expirate")
      .filter((vehicle) => selectedVehicleIds.includes(vehicle.id) || !usedVehicleIds.includes(vehicle.id)),
    [vehicles, usedVehicleIds, selectedVehicleIds]
  );

  const availableWorkers = useMemo(() =>
    workers.filter((worker) => selectedWorkerIds.includes(worker.id) || !usedWorkerIds.includes(worker.id)),
    [workers, usedWorkerIds, selectedWorkerIds]
  );

  const stats = useMemo(() => ({
    totalTeams: teams.length,
    totalWorkers: teams.reduce((acc, team) =>
      acc + teamWorkers.filter((item) => item.daily_team_id === team.id).length, 0),
    totalVehicles: teams.reduce((acc, team) =>
      acc + teamVehicles.filter((item) => item.daily_team_id === team.id).length, 0),
  }), [teams, teamWorkers, teamVehicles]);

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (team: Team) => {
    setEditingTeamId(team.id);
    setSelectedProjectId(team.project_id);
    setSelectedVehicleIds(teamVehicles.filter((item) => item.daily_team_id === team.id).map((item) => item.vehicle_id));
    setSelectedWorkerIds(teamWorkers.filter((item) => item.daily_team_id === team.id).map((item) => item.worker_id));
    setShowCreateModal(true);
  };

  const handleSaveTeam = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    if (!selectedProjectId) { alert("Selectează șantierul."); return; }
    if (selectedVehicleIds.length === 0) { alert("Selectează cel puțin un autoturism."); return; }
    if (selectedWorkerIds.length === 0) { alert("Selectează cel puțin un muncitor."); return; }

    setSaving(true);

    if (!editingTeamId) {
      const { data: teamInsert, error: teamError } = await supabase
        .from("daily_teams")
        .insert({ project_id: selectedProjectId, work_date: getTodayDate(), created_by: user.id })
        .select("id")
        .single();

      if (teamError || !teamInsert) {
        alert(`Eroare la crearea echipei: ${teamError?.message || ""}`);
        setSaving(false);
        return;
      }

      const { error: workerError } = await supabase
        .from("daily_team_workers")
        .insert(selectedWorkerIds.map((workerId) => ({ daily_team_id: teamInsert.id, worker_id: workerId })));
      if (workerError) { alert(`Eroare: ${workerError.message}`); setSaving(false); return; }

      const { error: vehicleError } = await supabase
        .from("daily_team_vehicles")
        .insert(selectedVehicleIds.map((vehicleId) => ({ daily_team_id: teamInsert.id, vehicle_id: vehicleId })));
      if (vehicleError) { alert(`Eroare: ${vehicleError.message}`); setSaving(false); return; }

    } else {
      const { error: updateTeamError } = await supabase
        .from("daily_teams")
        .update({ project_id: selectedProjectId })
        .eq("id", editingTeamId);
      if (updateTeamError) { alert(`Eroare: ${updateTeamError.message}`); setSaving(false); return; }

      await supabase.from("daily_team_workers").delete().eq("daily_team_id", editingTeamId);
      await supabase.from("daily_team_vehicles").delete().eq("daily_team_id", editingTeamId);

      const { error: insertWorkersError } = await supabase
        .from("daily_team_workers")
        .insert(selectedWorkerIds.map((workerId) => ({ daily_team_id: editingTeamId, worker_id: workerId })));
      if (insertWorkersError) { alert(`Eroare: ${insertWorkersError.message}`); setSaving(false); return; }

      const { error: insertVehiclesError } = await supabase
        .from("daily_team_vehicles")
        .insert(selectedVehicleIds.map((vehicleId) => ({ daily_team_id: editingTeamId, vehicle_id: vehicleId })));
      if (insertVehiclesError) { alert(`Eroare: ${insertVehiclesError.message}`); setSaving(false); return; }
    }

    setSaving(false);
    closeCreateModal();
    await loadData();
  };

  // Ștergere echipă cu parolă
  const openDeleteModal = (teamId: string) => {
    setDeleteConfirmTeamId(teamId);
    setDeletePassword("");
    setDeletePasswordError("");
  };

  const handleDeleteTeam = async () => {
    if (!deleteConfirmTeamId) return;

    if (deletePassword !== "brenado***") {
      setDeletePasswordError("Parolă incorectă. Încearcă din nou.");
      return;
    }

    setDeleting(true);

    await supabase.from("daily_team_workers").delete().eq("daily_team_id", deleteConfirmTeamId);
    await supabase.from("daily_team_vehicles").delete().eq("daily_team_id", deleteConfirmTeamId);
    const { error } = await supabase.from("daily_teams").delete().eq("id", deleteConfirmTeamId);

    if (error) {
      alert(`Eroare la ștergerea echipei: ${error.message}`);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteConfirmTeamId(null);
    setDeletePassword("");
    setDeletePasswordError("");
    await loadData();
  };

  // Transfer personal
  const openTransferModal = (workerId: string, workerName: string, fromTeamId: string) => {
    setTransferModal({ workerId, workerName, fromTeamId });
    setTransferTargetTeamId("");
  };

  const handleTransferWorker = async () => {
    if (!transferModal || !transferTargetTeamId) {
      alert("Selectează echipa destinație.");
      return;
    }

    setTransferring(true);

    const { error: removeError } = await supabase
      .from("daily_team_workers")
      .delete()
      .eq("daily_team_id", transferModal.fromTeamId)
      .eq("worker_id", transferModal.workerId);

    if (removeError) {
      alert(`Eroare la transfer: ${removeError.message}`);
      setTransferring(false);
      return;
    }

    const { error: addError } = await supabase
      .from("daily_team_workers")
      .insert({ daily_team_id: transferTargetTeamId, worker_id: transferModal.workerId });

    if (addError) {
      alert(`Eroare la adăugare în echipa nouă: ${addError.message}`);
      setTransferring(false);
      return;
    }

    setTransferring(false);
    setTransferModal(null);
    setTransferTargetTeamId("");
    await loadData();
  };

  // Export PDF
  const handleExportPdf = async (team: Team) => {
    const project = getProjectById(team.project_id);
    const currentVehicles = vehicles.filter((v) => getTeamVehicleIds(team.id).includes(v.id));
    const currentWorkers = workers.filter((w) => getTeamWorkerIds(team.id).includes(w.id));

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
    doc.text(`Echipa – ${project?.name || "-"}`, 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Beneficiar: ${project?.beneficiary || "-"}`, 14, 45);
    doc.text(`Locatie: ${project?.project_location || "-"}`, 14, 50);
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

    doc.save(`echipa_${(project?.name || "export").replace(/\s+/g, "_")}.pdf`);
  };

  const getProjectById = (projectId: string) =>
    projects.find((project) => project.id === projectId) || null;

  const getTeamVehicleIds = (teamId: string) =>
    teamVehicles.filter((item) => item.daily_team_id === teamId).map((item) => item.vehicle_id);

  const getTeamWorkerIds = (teamId: string) =>
    teamWorkers.filter((item) => item.daily_team_id === teamId).map((item) => item.worker_id);

  const getVehiclesPreview = (teamId: string) => {
    const regs = getTeamVehicleIds(teamId)
      .map((vehicleId) => vehicles.find((v) => v.id === vehicleId)?.registration_number)
      .filter(Boolean) as string[];
    if (regs.length === 0) return "-";
    if (regs.length === 1) return regs[0];
    return `${regs[0]} +${regs.length - 1}`;
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

  const transferTargetTeams = transferModal
    ? teams.filter((t) => t.id !== transferModal.fromTeamId)
    : [];

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la dashboard
            </button>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Creează echipă
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderTeamIcon()}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Planificare echipe</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Organizarea echipelor
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {isAdmin
                  ? "Echipele sunt permanente și valabile zilnic până la ștergerea lor."
                  : "Echipa ta de lucru."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-blue-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-blue-600 sm:text-3xl">{stats.totalTeams}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">Echipe</p>
            </div>
            <div className="rounded-2xl bg-green-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-green-600 sm:text-3xl">{stats.totalWorkers}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-300">Muncitori</p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-4 py-4 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-orange-600 sm:text-3xl">{stats.totalVehicles}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">Auto</p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {isAdmin ? "Echipe active" : "Echipa mea"}
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {teams.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {isAdmin
                  ? "Nu există echipe create. Apasă &bdquo;Creează echipă&rdquo; pentru a adăuga una."
                  : "Nu ești atribuit niciunei echipe. Contactează administratorul."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team, index) => {
                const project = getProjectById(team.project_id);
                const workerIds = getTeamWorkerIds(team.id);
                const workerCount = workerIds.length;
                const teamWorkersDetails = workers.filter((w) => workerIds.includes(w.id));

                return (
                  <div
                    key={team.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/organizarea-echipelor/${team.id}`)}
                      className="w-full text-left"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {isAdmin ? `Echipa ${index + 1}` : "Echipa mea"}
                          </h2>
                          <p className="mt-1 text-sm font-medium text-gray-500">{project?.name || "-"}</p>
                        </div>
                        <div className="text-3xl font-light text-gray-400">›</div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Auto atribuite</span>
                          <span className="text-right font-medium text-gray-900">{getVehiclesPreview(team.id)}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Muncitori</span>
                          <span className="text-right font-medium text-gray-900">{workerCount}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-500">Locație</span>
                          <span className="text-right font-medium text-gray-900">{project?.project_location || "-"}</span>
                        </div>
                      </div>
                    </button>

                    {/* Butoane admin pe card */}
                    {isAdmin && (
                      <div className="mt-4 space-y-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(team)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          Editează echipa
                        </button>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (teamWorkersDetails.length === 0) {
                                alert("Nu există muncitori în această echipă.");
                                return;
                              }
                              if (teamWorkersDetails.length === 1) {
                                openTransferModal(teamWorkersDetails[0].id, teamWorkersDetails[0].full_name, team.id);
                              } else {
                                setTransferModal({ workerId: "", workerName: "", fromTeamId: team.id });
                                setTransferTargetTeamId("");
                              }
                            }}
                            className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            Transferă personal
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportPdf(team)}
                            className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            title="Export PDF"
                          >
                            PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(team.id)}
                            className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            Șterge
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sef echipa — doar export PDF */}
                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleExportPdf(team)}
                        className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Export PDF
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL CREARE / EDITARE ECHIPĂ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingTeamId ? "Editează echipa" : "Creează echipa"}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingTeamId
                    ? "Modifică șantierul, mașinile și muncitorii."
                    : "Echipa va fi valabilă permanent până la ștergere."}
                </p>
              </div>
              <button type="button" onClick={closeCreateModal} className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">
                Închide
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Selectare șantier</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="">Alege șantier</option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">Selectare autoturism</p>
                  {availableVehicles.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">Nu există mașini disponibile.</div>
                  ) : (
                    <div className="space-y-2">
                      {availableVehicles.map((vehicle) => (
                        <label key={vehicle.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50">
                          <input type="checkbox" checked={selectedVehicleIds.includes(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} className="h-5 w-5" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{vehicle.registration_number}</p>
                            <p className="text-xs text-gray-500">{vehicle.brand} {vehicle.model}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Alege echipa
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Personal de execuție</span>
                  </p>
                  {availableWorkers.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Nu există muncitori disponibili. Toți sunt atribuiți altor echipe.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableWorkers.map((worker) => (
                        <label key={worker.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50">
                          <input type="checkbox" checked={selectedWorkerIds.includes(worker.id)} onChange={() => toggleWorker(worker.id)} className="h-5 w-5" />
                          <span className="text-sm font-medium text-gray-800">{worker.full_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-800">Șantier: {availableProjects.find((p) => p.id === selectedProjectId)?.name || "-"}</p>
                  <p className="mt-1 text-sm text-blue-800">Auto selectate: {selectedVehicleIds.length}</p>
                  <p className="mt-1 text-sm text-blue-800">Muncitori selectați: {selectedWorkerIds.length}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveTeam}
                    disabled={saving}
                    className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Se salvează..." : editingTeamId ? "Salvează modificările" : "Creează echipa"}
                  </button>
                  <button type="button" onClick={closeCreateModal} className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                    Renunță
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMARE ȘTERGERE CU PAROLĂ */}
      {deleteConfirmTeamId && (
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

              {(() => {
                const team = teams.find((t) => t.id === deleteConfirmTeamId);
                const project = team ? getProjectById(team.project_id) : null;
                const workerCount = deleteConfirmTeamId ? getTeamWorkerIds(deleteConfirmTeamId).length : 0;
                return team ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800">{project?.name || "-"}</p>
                    <p className="mt-1 text-xs text-red-600">{workerCount} muncitori · {getVehiclesPreview(deleteConfirmTeamId)} auto</p>
                  </div>
                ) : null;
              })()}

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
                  onClick={() => { setDeleteConfirmTeamId(null); setDeletePassword(""); setDeletePasswordError(""); }}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRANSFER PERSONAL */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Transferă personal</h3>
                <p className="mt-0.5 text-sm text-gray-500">Mută un muncitor în altă echipă</p>
              </div>
              <button
                type="button"
                onClick={() => { setTransferModal(null); setTransferTargetTeamId(""); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {!transferModal.workerId && (() => {
                const teamWorkersForModal = workers.filter((w) =>
                  teamWorkers.some((tw) => tw.daily_team_id === transferModal.fromTeamId && tw.worker_id === w.id)
                );
                return (
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-700">Selectează muncitorul de transferat</p>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {teamWorkersForModal.map((worker) => (
                        <button
                          key={worker.id}
                          type="button"
                          onClick={() => setTransferModal((prev) => prev ? { ...prev, workerId: worker.id, workerName: worker.full_name } : prev)}
                          className="w-full flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {worker.full_name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{worker.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {transferModal.workerId && (
                <>
                  <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-sm font-bold text-indigo-800">
                      {transferModal.workerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">{transferModal.workerName}</p>
                      <p className="text-xs text-indigo-600">
                        Din: {getProjectById(teams.find((t) => t.id === transferModal.fromTeamId)?.project_id || "")?.name || "-"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Echipa destinație</label>
                    {transferTargetTeams.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        Nu există alte echipe disponibile.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {transferTargetTeams.map((team) => {
                          const proj = getProjectById(team.project_id);
                          const wCount = getTeamWorkerIds(team.id).length;
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => setTransferTargetTeamId(team.id)}
                              className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                transferTargetTeamId === team.id
                                  ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                                  : "border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{proj?.name || "-"}</p>
                                <p className="text-xs text-gray-500">{proj?.project_location || "-"} · {wCount} muncitori</p>
                              </div>
                              {transferTargetTeamId === team.id && (
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-white" stroke="currentColor" strokeWidth="3">
                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {transferTargetTeamId && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-sm font-medium text-green-800">
                        <span className="font-bold">{transferModal.workerName}</span> va fi mutat în echipa{" "}
                        <span className="font-bold">{getProjectById(teams.find((t) => t.id === transferTargetTeamId)?.project_id || "")?.name || "-"}</span>.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleTransferWorker}
                      disabled={transferring || !transferTargetTeamId}
                      className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      {transferring ? "Se transferă..." : "Confirmă transferul"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTransferModal(null); setTransferTargetTeamId(""); }}
                      className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Anulează
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
