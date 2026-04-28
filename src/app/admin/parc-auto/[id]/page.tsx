"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

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
  has_rovinieta: boolean;
  rovinieta_valid_until: string | null;
  has_casco: boolean;
  casco_valid_until: string | null;
  is_leasing: boolean;
  monthly_rate: number | null;
  last_rate_date: string | null;
  status: VehicleStatus;
  created_at: string;
};

type VehicleDocumentHistory = {
  id: string;
  vehicle_id: string;
  document_type: "rca" | "itp" | "rovinieta" | "casco";
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
  autoutilitara: "Autoutilitară",
  microbuz: "Microbuz",
  masina_administrativa: "Mașină administrativă",
};

const categoryIconMap: Record<VehicleCategory, string> = {
  camion: "🚛",
  autoutilitara: "🚐",
  microbuz: "🚌",
  masina_administrativa: "🚗",
};

export default function DetaliuAutoPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [showRepairNoteForm, setShowRepairNoteForm] = useState(false);
  const [showDocumentHistory, setShowDocumentHistory] = useState(true);
  const [showRepairHistory, setShowRepairHistory] = useState(true);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documentHistory, setDocumentHistory] = useState<VehicleDocumentHistory[]>([]);
  const [vehicleNotes, setVehicleNotes] = useState<VehicleNote[]>([]);

  const [category, setCategory] = useState<VehicleCategory>("camion");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [rcaValidUntil, setRcaValidUntil] = useState("");
  const [itpValidUntil, setItpValidUntil] = useState("");

  const [hasRovinieta, setHasRovinieta] = useState(false);
  const [rovinietaValidUntil, setRovinietaValidUntil] = useState("");

  const [hasCasco, setHasCasco] = useState(false);
  const [cascoValidUntil, setCascoValidUntil] = useState("");

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
            has_rovinieta,
            rovinieta_valid_until,
            has_casco,
            casco_valid_until,
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

    setHasRovinieta(Boolean(vehicleData.has_rovinieta));
    setRovinietaValidUntil(vehicleData.rovinieta_valid_until || "");

    setHasCasco(Boolean(vehicleData.has_casco));
    setCascoValidUntil(vehicleData.casco_valid_until || "");

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
    return new Date(`${value}T00:00:00`).toLocaleDateString("ro-RO");
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

    if (rcaExpired || itpExpired) return "doc_expirate";

    return status;
  }, [rcaValidUntil, itpValidUntil, status, today]);

  const computedStatusLabel = useMemo(() => {
    if (computedStatus === "activa") return "Activă";
    if (computedStatus === "inactiva") return "Inactivă";
    if (computedStatus === "in_reparatie") return "În reparație";
    if (computedStatus === "doc_expirate") return "Doc. expirate";
    return computedStatus;
  }, [computedStatus]);

  const computedStatusClasses = useMemo(() => {
    if (computedStatus === "activa") return "bg-green-100 text-green-700";
    if (computedStatus === "inactiva") return "bg-gray-100 text-gray-700";
    if (computedStatus === "in_reparatie") return "bg-orange-100 text-orange-700";
    if (computedStatus === "doc_expirate") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  }, [computedStatus]);

  const warnings = useMemo(() => {
    const list: string[] = [];

    const rcaDays = getDaysUntil(rcaValidUntil || null);
    const itpDays = getDaysUntil(itpValidUntil || null);
    const rovinietaDays = hasRovinieta
      ? getDaysUntil(rovinietaValidUntil || null)
      : null;
    const cascoDays = hasCasco ? getDaysUntil(cascoValidUntil || null) : null;

    if (rcaDays !== null && rcaDays >= 0 && rcaDays <= 30) {
      list.push(`Expiră RCA în ${rcaDays} zile`);
    }

    if (itpDays !== null && itpDays >= 0 && itpDays <= 30) {
      list.push(`Expiră ITP în ${itpDays} zile`);
    }

    if (rovinietaDays !== null && rovinietaDays >= 0 && rovinietaDays <= 30) {
      list.push(`Expiră rovinieta în ${rovinietaDays} zile`);
    }

    if (cascoDays !== null && cascoDays >= 0 && cascoDays <= 30) {
      list.push(`Expiră CASCO în ${cascoDays} zile`);
    }

    return list;
  }, [
    rcaValidUntil,
    itpValidUntil,
    hasRovinieta,
    rovinietaValidUntil,
    hasCasco,
    cascoValidUntil,
    today,
  ]);

  const monthsRemaining = useMemo(() => {
    if (!isLeasing || !lastRateDate) return 0;

    const lastDate = parseDate(lastRateDate);
    if (!lastDate) return 0;

    const diff =
      (lastDate.getFullYear() - today.getFullYear()) * 12 +
      (lastDate.getMonth() - today.getMonth()) +
      1;

    return Math.max(0, diff);
  }, [isLeasing, lastRateDate, today]);

  const remainingLeasingValue = useMemo(() => {
    if (!isLeasing) return 0;
    return monthsRemaining * Number(monthlyRate || 0);
  }, [isLeasing, monthsRemaining, monthlyRate]);

  const repairNotes = useMemo(() => {
    return vehicleNotes.filter((note) => note.note_type === "reparatie");
  }, [vehicleNotes]);

  const totalRepairCost = useMemo(() => {
    return repairNotes.reduce((sum, note) => sum + Number(note.cost || 0), 0);
  }, [repairNotes]);

  const resetRepairFields = () => {
    setRepairTitle("");
    setRepairContent("");
    setRepairCost("");
    setRepairDate(new Date().toISOString().split("T")[0]);
    setShowRepairNoteForm(false);
  };

  const getDocumentTypeLabel = (
    type: "rca" | "itp" | "rovinieta" | "casco"
  ) => {
    if (type === "rca") return "RCA";
    if (type === "itp") return "ITP";
    if (type === "rovinieta") return "Rovignetă";
    return "CASCO";
  };

  const handleSave = async () => {
    if (!vehicle) return;

    if (!brand.trim()) {
      alert("Completează marca.");
      return;
    }

    if (!model.trim()) {
      alert("Completează modelul.");
      return;
    }

    if (!registrationNumber.trim()) {
      alert("Completează numărul de înmatriculare.");
      return;
    }

    if (!rcaValidUntil) {
      alert("Completează data RCA.");
      return;
    }

    if (!itpValidUntil) {
      alert("Completează data ITP.");
      return;
    }

    if (hasRovinieta && !rovinietaValidUntil) {
      alert("Completează data rovinietei.");
      return;
    }

    if (hasCasco && !cascoValidUntil) {
      alert("Completează data CASCO.");
      return;
    }

    if (isLeasing) {
      if (!monthlyRate || Number(monthlyRate) <= 0) {
        alert("Completează rata lunară.");
        return;
      }

      if (!lastRateDate) {
        alert("Completează data ultimei rate.");
        return;
      }
    }

    if (showRepairNoteForm) {
      if (!repairTitle.trim()) {
        alert("Completează titlul reparației.");
        return;
      }

      if (!repairContent.trim()) {
        alert("Completează observațiile reparației.");
        return;
      }

      if (!repairCost || Number(repairCost) < 0) {
        alert("Completează costul reparației.");
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
      has_rovinieta: hasRovinieta,
      rovinieta_valid_until: hasRovinieta ? rovinietaValidUntil || null : null,
      has_casco: hasCasco,
      casco_valid_until: hasCasco ? cascoValidUntil || null : null,
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
      alert(`A apărut o eroare la salvare: ${updateError.message}`);
      setSaving(false);
      return;
    }

    const documentHistoryRows: Array<{
      vehicle_id: string;
      document_type: "rca" | "itp" | "rovinieta" | "casco";
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

    if (
      Boolean(vehicle.has_rovinieta) !== Boolean(hasRovinieta) ||
      (vehicle.rovinieta_valid_until || null) !== (rovinietaValidUntil || null)
    ) {
      documentHistoryRows.push({
        vehicle_id: vehicleId,
        document_type: "rovinieta",
        old_date: vehicle.has_rovinieta
          ? vehicle.rovinieta_valid_until || null
          : null,
        new_date: hasRovinieta ? rovinietaValidUntil || null : null,
      });
    }

    if (
      Boolean(vehicle.has_casco) !== Boolean(hasCasco) ||
      (vehicle.casco_valid_until || null) !== (cascoValidUntil || null)
    ) {
      documentHistoryRows.push({
        vehicle_id: vehicleId,
        document_type: "casco",
        old_date: vehicle.has_casco ? vehicle.casco_valid_until || null : null,
        new_date: hasCasco ? cascoValidUntil || null : null,
      });
    }

    if (documentHistoryRows.length > 0) {
      const { error: historyError } = await supabase
        .from("vehicle_document_history")
        .insert(documentHistoryRows);

      if (historyError) {
        alert(
          `Modificările mașinii s-au salvat, dar istoricul documentelor nu s-a putut salva: ${historyError.message}`
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
          `Modificările mașinii s-au salvat, dar nota reparației nu s-a putut salva: ${noteError.message}`
        );
      }
    }

    setSaving(false);
    setShowEditModal(false);
    resetRepairFields();
    await loadVehicle();
  };

  const handleDelete = async () => {
    setDeleting(true);

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicleId);

    if (error) {
      alert(`A apărut o eroare la ștergere: ${error.message}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/admin/parc-auto");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
        <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
              <div className="text-3xl">🚗</div>
            </div>

            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return <div className="p-6">Vehiculul nu a fost găsit.</div>;
  }

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

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/parc-auto")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Înapoi la parc auto
            </button>

<button
  onClick={() => router.push(`/admin/parc-auto/${vehicleId}/edit`)}
  className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
>
  Actualizează
</button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Detaliu vehicul</p>

              <div className="mt-3 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#F8F7F3] text-3xl shadow-sm">
                  {categoryIconMap[category]}
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    {brand} {model}
                  </h1>
                  <p className="mt-2 text-sm text-gray-500 sm:text-base">
                    Nr. înmatriculare:{" "}
                    <span className="font-semibold text-gray-700">
                      {registrationNumber}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${computedStatusClasses}`}
              >
                {computedStatusLabel}
              </span>

              {hasRovinieta && (
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Rovignetă
                </span>
              )}

              {hasCasco && (
                <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                  CASCO
                </span>
              )}

              {isLeasing && (
                <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Leasing
                </span>
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {warnings.map((warning) => (
                <span
                  key={warning}
                  className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
                >
                  {warning}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Categorie
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {categoryLabelMap[category]}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                RCA
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {formatDate(rcaValidUntil)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                ITP
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {formatDate(itpValidUntil)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                Rovignetă
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {hasRovinieta ? formatDate(rovinietaValidUntil) : "Nu"}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                CASCO
              </p>
              <p className="mt-2 text-sm font-bold text-gray-900">
                {hasCasco ? formatDate(cascoValidUntil) : "Nu"}
              </p>
            </div>
          </div>
        </section>

        {isLeasing && (
          <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Detalii leasing
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Valori calculate automat în funcție de rata lunară și data ultimei rate.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-purple-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                  Rata lunară
                </p>
                <p className="mt-2 text-sm font-bold text-purple-900">
                  {Number(monthlyRate || 0).toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                  Ultima rată
                </p>
                <p className="mt-2 text-sm font-bold text-purple-900">
                  {formatDate(lastRateDate)}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                  Luni rămase
                </p>
                <p className="mt-2 text-sm font-bold text-purple-900">
                  {monthsRemaining}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-purple-600">
                  Rămas de plată
                </p>
                <p className="mt-2 text-sm font-bold text-purple-900">
                  {remainingLeasingValue.toFixed(2)} lei
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowDocumentHistory((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#FCFBF8]"
            >
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Istoric documente
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Modificările RCA, ITP, rovignetă și CASCO apar aici.
                </p>
              </div>

              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F8F7F3] text-xl font-semibold text-gray-700">
                {showDocumentHistory ? "−" : "+"}
              </span>
            </button>

            {showDocumentHistory && (
              <div className="border-t border-[#E8E5DE] p-5">
                {documentHistory.length === 0 ? (
                  <div className="rounded-2xl bg-[#FCFBF8] px-4 py-4 text-sm text-gray-500">
                    Nu există istoric de documente.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documentHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {getDocumentTypeLabel(item.document_type)}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {formatDate(item.old_date)} →{" "}
                              {formatDate(item.new_date)}
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

          <div className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowRepairHistory((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#FCFBF8]"
            >
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Istoric reparații
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Toate notele de reparație salvate pentru acest vehicul.
                </p>
              </div>

              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F8F7F3] text-xl font-semibold text-gray-700">
                {showRepairHistory ? "−" : "+"}
              </span>
            </button>

            {showRepairHistory && (
              <div className="border-t border-[#E8E5DE] p-5">
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-orange-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-orange-600">
                      Total reparații
                    </p>
                    <p className="mt-2 text-sm font-bold text-orange-900">
                      {repairNotes.length}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-orange-600">
                      Cost total
                    </p>
                    <p className="mt-2 text-sm font-bold text-orange-900">
                      {totalRepairCost.toFixed(2)} lei
                    </p>
                  </div>
                </div>

                {repairNotes.length === 0 ? (
                  <div className="rounded-2xl bg-[#FCFBF8] px-4 py-4 text-sm text-gray-500">
                    Nu există reparații salvate.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {repairNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {note.title || "Reparație"}
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
        </section>
      </main>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-6 md:pt-10">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Actualizează auto
                </h2>
                <p className="text-sm text-gray-500">
                  Modifică datele vehiculului și adaugă reparații.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  resetRepairFields();
                }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Închide
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-6">
                <div className="rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                  <h3 className="text-base font-bold text-gray-900">
                    Informații generale
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Categorie auto
                      </label>
                      <select
                        value={category}
                        onChange={(e) =>
                          setCategory(e.target.value as VehicleCategory)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      >
                        <option value="camion">Camion</option>
                        <option value="autoutilitara">Autoutilitară</option>
                        <option value="microbuz">Microbuz</option>
                        <option value="masina_administrativa">
                          Mașină administrativă
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
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      >
                        <option value="activa">Activă</option>
                        <option value="inactiva">Inactivă</option>
                        <option value="in_reparatie">În reparație</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Marcă
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
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
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Nr. înmatriculare
                      </label>
                      <input
                        type="text"
                        value={registrationNumber}
                        onChange={(e) =>
                          setRegistrationNumber(e.target.value.toUpperCase())
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 uppercase outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                  <h3 className="text-base font-bold text-gray-900">
                    Documente și valabilitate
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        RCA valabil până la
                      </label>
                      <input
                        type="date"
                        value={rcaValidUntil}
                        onChange={(e) => setRcaValidUntil(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        ITP valabil până la
                      </label>
                      <input
                        type="date"
                        value={itpValidUntil}
                        onChange={(e) => setItpValidUntil(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasRovinieta}
                        onChange={(e) => setHasRovinieta(e.target.checked)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Are rovignetă
                      </span>
                    </label>

                    {hasRovinieta && (
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Rovignetă valabilă până la
                        </label>
                        <input
                          type="date"
                          value={rovinietaValidUntil}
                          onChange={(e) => setRovinietaValidUntil(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasCasco}
                        onChange={(e) => setHasCasco(e.target.checked)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Are CASCO
                      </span>
                    </label>

                    {hasCasco && (
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          CASCO valabil până la
                        </label>
                        <input
                          type="date"
                          value={cascoValidUntil}
                          onChange={(e) => setCascoValidUntil(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                  <h3 className="text-base font-bold text-gray-900">
                    Leasing
                  </h3>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isLeasing}
                        onChange={(e) => setIsLeasing(e.target.checked)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        Vehicul în leasing
                      </span>
                    </label>

                    {isLeasing && (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Rată lunară
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={monthlyRate}
                            onChange={(e) => setMonthlyRate(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
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
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                  <button
                    type="button"
                    onClick={() => setShowRepairNoteForm((prev) => !prev)}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                      showRepairNoteForm
                        ? "bg-gray-500 hover:bg-gray-600"
                        : "bg-[#0196ff] hover:opacity-90"
                    }`}
                  >
                    {showRepairNoteForm
                      ? "Ascunde nota reparație"
                      : "Adaugă notă reparație +"}
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
                          placeholder="Ex: Schimb plăcuțe frână"
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Cost reparație TVA inclus
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={repairCost}
                          onChange={(e) => setRepairCost(e.target.value)}
                          placeholder="Ex: 850"
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Data reparației
                        </label>
                        <input
                          type="date"
                          value={repairDate}
                          onChange={(e) => setRepairDate(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Observații
                        </label>
                        <textarea
                          value={repairContent}
                          onChange={(e) => setRepairContent(e.target.value)}
                          rows={4}
                          placeholder="Scrie aici detaliile reparației..."
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Se salvează..." : "Salvează modificările"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting}
                    className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    Șterge auto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6 text-red-600"
                >
                  <path
                    d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h2 className="text-lg font-extrabold text-gray-900">
                Șterge vehicul
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Ești sigur că vrei să ștergi{" "}
                <span className="font-semibold text-gray-800">
                  {brand} {model}
                </span>{" "}
                ({registrationNumber})? Această acțiune nu poate fi anulată.
              </p>
            </div>

            <div className="flex gap-3 border-t border-[#E8E5DE] px-6 py-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Se șterge..." : "Da, șterge"}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
 <BottomNav />
    </div>
  );
}