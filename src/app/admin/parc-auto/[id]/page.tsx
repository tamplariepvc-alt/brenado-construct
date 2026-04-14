"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

type VehicleStatus = "activa" | "inactiva" | "in_reparatie";

type Vehicle = {
  id: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  registration_number: string;
  rca_valid_until: string | null;
  itp_valid_until: string | null;
  is_leasing: boolean;
  monthly_rate: number | null;
  last_rate_date: string | null;
  status: VehicleStatus;
  created_at: string;
};

type VehicleDocumentHistory = {
  id: string;
  vehicle_id: string;
  document_type: "rca" | "itp";
  old_date: string | null;
  new_date: string | null;
  created_at: string;
};

type VehicleNote = {
  id: string;
  vehicle_id: string;
  note_type: "reparatie" | "observatie";
  title: string | null;
  content: string;
  cost: number | null;
  note_date: string | null;
  created_at: string;
};

const categoryLabelMap: Record<VehicleCategory, string> = {
  camion: "Camion",
  autoutilitara: "Autoutilitara",
  microbuz: "Microbuz",
  masina_administrativa: "Masina administrativa",
};

export default function DetaliuAutoPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [showRepairNoteForm, setShowRepairNoteForm] = useState(false);
  const [showDocumentHistory, setShowDocumentHistory] = useState(false);
  const [showRepairHistory, setShowRepairHistory] = useState(false);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documentHistory, setDocumentHistory] = useState<VehicleDocumentHistory[]>([]);
  const [vehicleNotes, setVehicleNotes] = useState<VehicleNote[]>([]);

  const [category, setCategory] = useState<VehicleCategory>("camion");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [rcaValidUntil, setRcaValidUntil] = useState("");
  const [itpValidUntil, setItpValidUntil] = useState("");
  const [isLeasing, setIsLeasing] = useState(false);
  const [monthlyRate, setMonthlyRate] = useState("");
  const [lastRateDate, setLastRateDate] = useState("");
  const [status, setStatus] = useState<VehicleStatus>("activa");

  const [repairTitle, setRepairTitle] = useState("");
  const [repairContent, setRepairContent] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [repairDate, setRepairDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const loadVehicle = async () => {
    setLoading(true);

    const [vehicleResponse, documentHistoryResponse, notesResponse] =
      await Promise.all([
        supabase
          .from("vehicles")
          .select(`
            id,
            category,
            brand,
            model,
            registration_number,
            rca_valid_until,
            itp_valid_until,
            is_leasing,
            monthly_rate,
            last_rate_date,
            status,
            created_at
          `)
          .eq("id", vehicleId)
          .single(),

        supabase
          .from("vehicle_document_history")
          .select(`
            id,
            vehicle_id,
            document_type,
            old_date,
            new_date,
            created_at
          `)
          .eq("vehicle_id", vehicleId)
          .order("created_at", { ascending: false }),

        supabase
          .from("vehicle_notes")
          .select(`
            id,
            vehicle_id,
            note_type,
            title,
            content,
            cost,
            note_date,
            created_at
          `)
          .eq("vehicle_id", vehicleId)
          .order("note_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

    if (vehicleResponse.error || !vehicleResponse.data) {
      router.push("/admin/parc-auto");
      return;
    }

    const vehicleData = vehicleResponse.data as Vehicle;

    setVehicle(vehicleData);
    setCategory(vehicleData.category);
    setBrand(vehicleData.brand || "");
    setModel(vehicleData.model || "");
    setRegistrationNumber(vehicleData.registration_number || "");
    setRcaValidUntil(vehicleData.rca_valid_until || "");
    setItpValidUntil(vehicleData.itp_valid_until || "");
    setIsLeasing(Boolean(vehicleData.is_leasing));
    setMonthlyRate(
      vehicleData.monthly_rate != null
        ? String(Number(vehicleData.monthly_rate))
        : ""
    );
    setLastRateDate(vehicleData.last_rate_date || "");
    setStatus(vehicleData.status);

    setDocumentHistory(
      (documentHistoryResponse.data as VehicleDocumentHistory[]) || []
    );
    setVehicleNotes((notesResponse.data as VehicleNote[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ro-RO");
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("ro-RO");
  };

  const getDaysUntil = (value: string | null) => {
    const targetDate = parseDate(value);
    if (!targetDate) return null;

    const diffMs = targetDate.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const computedStatus = useMemo(() => {
    const rcaDate = parseDate(rcaValidUntil || null);
    const itpDate = parseDate(itpValidUntil || null);

    const rcaExpired = rcaDate ? rcaDate.getTime() < today.getTime() : false;
    const itpExpired = itpDate ? itpDate.getTime() < today.getTime() : false;

    if (rcaExpired || itpExpired) {
      return "doc_expirate";
    }

    return status;
  }, [rcaValidUntil, itpValidUntil, status, today]);

  const computedStatusLabel = useMemo(() => {
    if (computedStatus === "activa") return "Activa";
    if (computedStatus === "inactiva") return "Inactiva";
    if (computedStatus === "in_reparatie") return "In reparatie";
    if (computedStatus === "doc_expirate") return "Doc. expirate";
    return computedStatus;
  }, [computedStatus]);

  const computedStatusClasses = useMemo(() => {
    if (computedStatus === "activa") {
      return "bg-green-100 text-green-700";
    }

    if (computedStatus === "inactiva") {
      return "bg-gray-100 text-gray-700";
    }

    if (computedStatus === "in_reparatie") {
      return "bg-orange-100 text-orange-700";
    }

    if (computedStatus === "doc_expirate") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  }, [computedStatus]);

  const warnings = useMemo(() => {
    const list: string[] = [];

    const rcaDays = getDaysUntil(rcaValidUntil || null);
    const itpDays = getDaysUntil(itpValidUntil || null);

    if (rcaDays !== null && rcaDays >= 0 && rcaDays <= 30) {
      list.push(`Expira RCA in ${rcaDays} zile`);
    }

    if (itpDays !== null && itpDays >= 0 && itpDays <= 30) {
      list.push(`Expira ITP in ${itpDays} zile`);
    }

    return list;
  }, [rcaValidUntil, itpValidUntil, today]);

  const monthsRemaining = useMemo(() => {
    if (!isLeasing || !lastRateDate) return 0;

    const lastDate = parseDate(lastRateDate);
    if (!lastDate) return 0;

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const lastYear = lastDate.getFullYear();
    const lastMonth = lastDate.getMonth();

    const diff =
      (lastYear - currentYear) * 12 + (lastMonth - currentMonth) + 1;

    return Math.max(0, diff);
  }, [isLeasing, lastRateDate, today]);

  const remainingLeasingValue = useMemo(() => {
    if (!isLeasing) return 0;
    return monthsRemaining * Number(monthlyRate || 0);
  }, [isLeasing, monthsRemaining, monthlyRate]);

  const repairNotes = useMemo(() => {
    return vehicleNotes.filter((note) => note.note_type === "reparatie");
  }, [vehicleNotes]);

  const resetRepairFields = () => {
    setRepairTitle("");
    setRepairContent("");
    setRepairCost("");
    setRepairDate(new Date().toISOString().split("T")[0]);
    setShowRepairNoteForm(false);
  };

  const handleSave = async () => {
    if (!vehicle) return;

    if (!brand.trim()) {
      alert("Completeaza marca.");
      return;
    }

    if (!model.trim()) {
      alert("Completeaza modelul.");
      return;
    }

    if (!registrationNumber.trim()) {
      alert("Completeaza numarul de inmatriculare.");
      return;
    }

    if (!rcaValidUntil) {
      alert("Completeaza data RCA.");
      return;
    }

    if (!itpValidUntil) {
      alert("Completeaza data ITP.");
      return;
    }

    if (isLeasing) {
      if (!monthlyRate || Number(monthlyRate) <= 0) {
        alert("Completeaza rata lunara.");
        return;
      }

      if (!lastRateDate) {
        alert("Completeaza data ultimei rate.");
        return;
      }
    }

    if (showRepairNoteForm) {
      if (!repairTitle.trim()) {
        alert("Completeaza titlul reparatiei.");
        return;
      }

      if (!repairContent.trim()) {
        alert("Completeaza observatiile reparatiei.");
        return;
      }

      if (!repairCost || Number(repairCost) < 0) {
        alert("Completeaza costul reparatiei.");
        return;
      }
    }

    setSaving(true);

    const payload = {
      category,
      brand: brand.trim(),
      model: model.trim(),
      registration_number: registrationNumber.trim().toUpperCase(),
      rca_valid_until: rcaValidUntil || null,
      itp_valid_until: itpValidUntil || null,
      is_leasing: isLeasing,
      monthly_rate: isLeasing ? Number(monthlyRate || 0) : null,
      last_rate_date: isLeasing ? lastRateDate || null : null,
      status,
    };

    const { error: updateError } = await supabase
      .from("vehicles")
      .update(payload)
      .eq("id", vehicleId);

    if (updateError) {
      alert(`A aparut o eroare la salvare: ${updateError.message}`);
      setSaving(false);
      return;
    }

    const documentHistoryRows: Array<{
      vehicle_id: string;
      document_type: "rca" | "itp";
      old_date: string | null;
      new_date: string | null;
    }> = [];

    if ((vehicle.rca_valid_until || null) !== (rcaValidUntil || null)) {
      documentHistoryRows.push({
        vehicle_id: vehicleId,
        document_type: "rca",
        old_date: vehicle.rca_valid_until || null,
        new_date: rcaValidUntil || null,
      });
    }

    if ((vehicle.itp_valid_until || null) !== (itpValidUntil || null)) {
      documentHistoryRows.push({
        vehicle_id: vehicleId,
        document_type: "itp",
        old_date: vehicle.itp_valid_until || null,
        new_date: itpValidUntil || null,
      });
    }

    if (documentHistoryRows.length > 0) {
      const { error: historyError } = await supabase
        .from("vehicle_document_history")
        .insert(documentHistoryRows);

      if (historyError) {
        alert(
          `Modificarile masinii s-au salvat, dar istoricul documentelor nu s-a putut salva: ${historyError.message}`
        );
      }
    }

    if (showRepairNoteForm && repairContent.trim()) {
      const notePayload = {
        vehicle_id: vehicleId,
        note_type: "reparatie",
        title: repairTitle.trim() || null,
        content: repairContent.trim(),
        cost: repairCost ? Number(repairCost) : null,
        note_date: repairDate || null,
      };

      const { error: noteError } = await supabase
        .from("vehicle_notes")
        .insert(notePayload);

      if (noteError) {
        alert(
          `Modificarile masinii s-au salvat, dar nota reparatiei nu s-a putut salva: ${noteError.message}`
        );
      }
    }

    setSaving(false);
    setShowEditModal(false);
    resetRepairFields();
    await loadVehicle();
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Sigur vrei sa stergi acest vehicul?");
    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicleId);

    if (error) {
      alert(`A aparut o eroare la stergere: ${error.message}`);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    router.push("/admin/parc-auto");
  };

  if (loading) {
    return <div className="p-6">Se incarca datele vehiculului...</div>;
  }

  if (!vehicle) {
    return <div className="p-6">Vehiculul nu a fost gasit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detaliu auto</h1>
            <p className="text-sm text-gray-600">
              Vezi detaliile vehiculului si actualizeaza datele cand este nevoie.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/admin/parc-auto")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Inapoi la parc auto
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
            >
              Actualizeaza
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {brand} {model}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Nr. inmatriculare: {registrationNumber}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${computedStatusClasses}`}
                >
                  {computedStatusLabel}
                </span>

                {warnings.map((warning) => (
                  <span
                    key={warning}
                    className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Categorie</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {categoryLabelMap[category]}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Marca</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {brand}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Model</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {model}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Nr. inmatriculare
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {registrationNumber}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  RCA valabil pana la
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatDate(rcaValidUntil)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  ITP valabil pana la
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatDate(itpValidUntil)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Leasing</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {isLeasing ? "Da" : "Nu"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">
                  Status manual
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {status === "activa"
                    ? "Activa"
                    : status === "inactiva"
                    ? "Inactiva"
                    : "In reparatie"}
                </p>
              </div>
            </div>
          </div>

          {isLeasing && (
            <div className="rounded-2xl bg-white p-5 shadow">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Detalii leasing</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Valori calculate automat in functie de rata lunara si data ultimei rate.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Rata lunara</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {Number(monthlyRate || 0).toFixed(2)} lei
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Data ultimei rate
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatDate(lastRateDate)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">Luni ramase</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {monthsRemaining}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Ramas de plata
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {remainingLeasingValue.toFixed(2)} lei
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-white shadow">
            <button
              type="button"
              onClick={() => setShowDocumentHistory((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Istoric documente
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Modificarile facute pentru RCA si ITP apar automat aici.
                </p>
              </div>

              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-700">
                {showDocumentHistory ? "−" : "+"}
              </span>
            </button>

            {showDocumentHistory && (
              <div className="border-t border-gray-200 p-5">
                {documentHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu exista istoric de documente.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documentHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.document_type === "rca" ? "RCA" : "ITP"}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {formatDate(item.old_date)} {" -> "} {formatDate(item.new_date)}
                            </p>
                          </div>

                          <p className="text-xs text-gray-500">
                            {formatDateTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow">
            <button
              type="button"
              onClick={() => setShowRepairHistory((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Istoric reparatii
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Tot ce este salvat ca reparatie apare aici.
                </p>
              </div>

              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-700">
                {showRepairHistory ? "−" : "+"}
              </span>
            </button>

            {showRepairHistory && (
              <div className="border-t border-gray-200 p-5">
                {repairNotes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu exista reparatii salvate.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {repairNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {note.title || "Reparatie"}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {note.content}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                              <span>Data: {formatDate(note.note_date)}</span>
                              {note.cost != null && (
                                <span>
                                  Cost: {Number(note.cost).toFixed(2)} lei
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-gray-500">
                            {formatDateTime(note.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Actualizeaza auto</h2>
                <p className="text-sm text-gray-500">
                  Modifica datele vehiculului si adauga reparatii.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  resetRepairFields();
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Inchide
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Categorie auto
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as VehicleCategory)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="camion">Camion</option>
                    <option value="autoutilitara">Autoutilitara</option>
                    <option value="microbuz">Microbuz</option>
                    <option value="masina_administrativa">
                      Masina administrativa
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Status manual
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                    <option value="in_reparatie">In reparatie</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nr. inmatriculare
                  </label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) =>
                      setRegistrationNumber(e.target.value.toUpperCase())
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 uppercase outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    RCA valabil pana la
                  </label>
                  <input
                    type="date"
                    value={rcaValidUntil}
                    onChange={(e) => setRcaValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    ITP valabil pana la
                  </label>
                  <input
                    type="date"
                    value={itpValidUntil}
                    onChange={(e) => setItpValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isLeasing}
                    onChange={(e) => setIsLeasing(e.target.checked)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Leasing
                  </span>
                </label>
              </div>

              {isLeasing && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Rata lunara
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyRate}
                      onChange={(e) => setMonthlyRate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Data ultimei rate
                    </label>
                    <input
                      type="date"
                      value={lastRateDate}
                      onChange={(e) => setLastRateDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <button
                  type="button"
                  onClick={() => setShowRepairNoteForm((prev) => !prev)}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition ${
                    showRepairNoteForm
                      ? "bg-gray-500 hover:bg-gray-600"
                      : "bg-[#0196ff] hover:opacity-90"
                  }`}
                >
                  {showRepairNoteForm
                    ? "Ascunde nota reparatie"
                    : "Adauga nota reparatie +"}
                </button>

                {showRepairNoteForm && (
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Titlu
                      </label>
                      <input
                        type="text"
                        value={repairTitle}
                        onChange={(e) => setRepairTitle(e.target.value)}
                        placeholder="Ex: Schimb placute frana"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Cost reparatie (TVA inclus)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={repairCost}
                        onChange={(e) => setRepairCost(e.target.value)}
                        placeholder="Ex: 850"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Data reparatie
                      </label>
                      <input
                        type="date"
                        value={repairDate}
                        onChange={(e) => setRepairDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Observatii
                      </label>
                      <textarea
                        value={repairContent}
                        onChange={(e) => setRepairContent(e.target.value)}
                        rows={4}
                        placeholder="Scrie aici detaliile reparatiei..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Se salveaza..." : "Salveaza modificarile"}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? "Se sterge..." : "Sterge auto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}