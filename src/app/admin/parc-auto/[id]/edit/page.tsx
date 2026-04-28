"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory = "camion" | "autoutilitara" | "microbuz" | "masina_administrativa";
type VehicleStatus = "activa" | "inactiva" | "in_reparatie";

type Vehicle = {
  id: string; category: VehicleCategory; brand: string; model: string;
  registration_number: string;
  rca_valid_until: string | null; rca_cost: number | null;
  itp_valid_until: string | null; itp_cost: number | null;
  has_rovinieta: boolean; rovinieta_valid_until: string | null; rovinieta_cost: number | null;
  has_casco: boolean; casco_valid_until: string | null; casco_cost: number | null;
  is_leasing: boolean; monthly_rate: number | null; last_rate_date: string | null;
  status: VehicleStatus;
};

const categoryLabels: Record<VehicleCategory, string> = {
  camion: "Camion", autoutilitara: "Autoutilitară", microbuz: "Microbuz", masina_administrativa: "Mașină administrativă",
};

export default function EditAutoPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [category, setCategory] = useState<VehicleCategory>("camion");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  const [rcaValidUntil, setRcaValidUntil] = useState("");
  const [rcaCost, setRcaCost] = useState("");
  const [itpValidUntil, setItpValidUntil] = useState("");
  const [itpCost, setItpCost] = useState("");

  const [hasRovinieta, setHasRovinieta] = useState(false);
  const [rovinietaValidUntil, setRovinietaValidUntil] = useState("");
  const [rovinietaCost, setRovinietaCost] = useState("");

  const [hasCasco, setHasCasco] = useState(false);
  const [cascoValidUntil, setCascoValidUntil] = useState("");
  const [cascoCost, setCascoCost] = useState("");

  const [isLeasing, setIsLeasing] = useState(false);
  const [monthlyRate, setMonthlyRate] = useState("");
  const [lastRateDate, setLastRateDate] = useState("");
  const [status, setStatus] = useState<VehicleStatus>("activa");

  useEffect(() => {
    const loadVehicle = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, category, brand, model, registration_number, rca_valid_until, rca_cost, itp_valid_until, itp_cost, has_rovinieta, rovinieta_valid_until, rovinieta_cost, has_casco, casco_valid_until, casco_cost, is_leasing, monthly_rate, last_rate_date, status")
        .eq("id", vehicleId).single();

      if (error || !data) { router.push("/admin/parc-auto"); return; }

      const v = data as Vehicle;
      setCategory(v.category);
      setBrand(v.brand || "");
      setModel(v.model || "");
      setRegistrationNumber(v.registration_number || "");
      setRcaValidUntil(v.rca_valid_until || "");
      setRcaCost(v.rca_cost != null ? String(v.rca_cost) : "");
      setItpValidUntil(v.itp_valid_until || "");
      setItpCost(v.itp_cost != null ? String(v.itp_cost) : "");
      setHasRovinieta(Boolean(v.has_rovinieta));
      setRovinietaValidUntil(v.rovinieta_valid_until || "");
      setRovinietaCost(v.rovinieta_cost != null ? String(v.rovinieta_cost) : "");
      setHasCasco(Boolean(v.has_casco));
      setCascoValidUntil(v.casco_valid_until || "");
      setCascoCost(v.casco_cost != null ? String(v.casco_cost) : "");
      setIsLeasing(Boolean(v.is_leasing));
      setMonthlyRate(v.monthly_rate != null ? String(Number(v.monthly_rate)) : "");
      setLastRateDate(v.last_rate_date || "");
      setStatus(v.status);
      setLoading(false);
    };
    loadVehicle();
  }, [vehicleId, router]);

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

  const monthsRemaining = useMemo(() => {
    if (!isLeasing || !lastRateDate) return 0;
    const lastDate = parseDate(lastRateDate);
    if (!lastDate) return 0;
    const diff = (lastDate.getFullYear() - today.getFullYear()) * 12 + (lastDate.getMonth() - today.getMonth()) + 1;
    return Math.max(0, diff);
  }, [isLeasing, lastRateDate, today]);

  const remainingLeasingValue = useMemo(() => {
    if (!isLeasing) return 0;
    return monthsRemaining * Number(monthlyRate || 0);
  }, [isLeasing, monthsRemaining, monthlyRate]);

  const handleSubmit = async () => {
    if (!brand.trim()) { alert("Completează marca."); return; }
    if (!model.trim()) { alert("Completează modelul."); return; }
    if (!registrationNumber.trim()) { alert("Completează numărul de înmatriculare."); return; }
    if (!rcaValidUntil) { alert("Completează data RCA."); return; }
    if (!itpValidUntil) { alert("Completează data ITP."); return; }
    if (hasRovinieta && !rovinietaValidUntil) { alert("Completează data rovinietei."); return; }
    if (hasCasco && !cascoValidUntil) { alert("Completează data CASCO."); return; }
    if (isLeasing) {
      if (!monthlyRate || Number(monthlyRate) <= 0) { alert("Completează rata lunară pentru leasing."); return; }
      if (!lastRateDate) { alert("Selectează data ultimei rate."); return; }
    }

    setSubmitting(true);

    const { error } = await supabase.from("vehicles").update({
      category, brand: brand.trim(), model: model.trim(),
      registration_number: registrationNumber.trim().toUpperCase(),
      rca_valid_until: rcaValidUntil || null,
      rca_cost: rcaCost ? Number(rcaCost) : null,
      itp_valid_until: itpValidUntil || null,
      itp_cost: itpCost ? Number(itpCost) : null,
      has_rovinieta: hasRovinieta,
      rovinieta_valid_until: hasRovinieta ? rovinietaValidUntil || null : null,
      rovinieta_cost: hasRovinieta && rovinietaCost ? Number(rovinietaCost) : null,
      has_casco: hasCasco,
      casco_valid_until: hasCasco ? cascoValidUntil || null : null,
      casco_cost: hasCasco && cascoCost ? Number(cascoCost) : null,
      is_leasing: isLeasing,
      monthly_rate: isLeasing ? Number(monthlyRate || 0) : null,
      last_rate_date: isLeasing ? lastRateDate || null : null,
      status,
    }).eq("id", vehicleId);

    if (error) { alert(`A apărut o eroare la salvare: ${error.message}`); setSubmitting(false); return; }

    setSubmitting(false);
    router.refresh();
    router.push("/admin/parc-auto");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);
    if (error) { alert(`A apărut o eroare la ștergere: ${error.message}`); setDeleting(false); setShowDeleteConfirm(false); return; }
    router.push("/admin/parc-auto");
  };

  const renderCarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-amber-600 sm:h-7 sm:w-7">
      <path d="M6 16h12l-1-5a2 2 0 0 0-2-1.6H9A2 2 0 0 0 7 11l-1 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 16v2M19 16v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );

  const CostInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
          defaultValue={value}
          onBlur={(e) => onChange(e.target.value)}
          placeholder="Ex: 450.00"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-14 text-sm outline-none transition focus:border-gray-500" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">RON</span>
      </div>
    </div>
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-50">{renderCarIcon()}</div>
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
          <button onClick={() => router.push("/admin/parc-auto")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la parc auto
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-amber-50 sm:h-14 sm:w-14">{renderCarIcon()}</div>
              <div>
                <p className="text-sm text-gray-500">Administrare vehicul</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Editează auto</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${computedStatusClasses}`}>{computedStatusLabel}</span>
                  {isLeasing && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">Leasing</span>}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
              Șterge
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Categorie</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{categoryLabels[category]}</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Nr. auto</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{registrationNumber || "-"}</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">RCA</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(rcaValidUntil || null)}</p>
            </div>
            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">ITP</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(itpValidUntil || null)}</p>
            </div>
          </div>
        </section>

        {/* Leasing summary */}
        {isLeasing && (
          <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <div className="mb-4 flex items-center gap-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Detalii leasing</p>
              <div className="h-px flex-1 bg-[#E8E5DE]" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-purple-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-500">Rată lunară</p>
                <p className="mt-1 text-xl font-extrabold text-purple-700">{Number(monthlyRate || 0).toFixed(2)} lei</p>
              </div>
              <div className="rounded-2xl bg-purple-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-500">Luni rămase</p>
                <p className="mt-1 text-xl font-extrabold text-purple-700">{monthsRemaining}</p>
              </div>
              <div className="rounded-2xl bg-purple-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-500">Rămas de plată</p>
                <p className="mt-1 text-xl font-extrabold text-purple-700">{remainingLeasingValue.toFixed(2)} lei</p>
              </div>
            </div>
          </section>
        )}

        {/* Formular */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Informații vehicul</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Categorie auto</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
                <option value="camion">Camion</option>
                <option value="autoutilitara">Autoutilitară</option>
                <option value="microbuz">Microbuz</option>
                <option value="masina_administrativa">Mașină administrativă</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Status manual</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
                <option value="activa">Activă</option>
                <option value="inactiva">Inactivă</option>
                <option value="in_reparatie">În reparație</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Marcă</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Ford"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Model</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex: Transit"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Nr. înmatriculare</label>
              <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="Ex: B123ABC"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-gray-500" />
            </div>
          </div>
        </section>

        {/* Documente */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Documente</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* RCA */}
            <div className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4">
              <p className="text-sm font-semibold text-gray-800">RCA</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Valabil până la</label>
                  <input type="date" value={rcaValidUntil} onChange={(e) => setRcaValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
                </div>
                <CostInput label="Cost (RON)" value={rcaCost} onChange={setRcaCost} />
              </div>
            </div>

            {/* ITP */}
            <div className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4">
              <p className="text-sm font-semibold text-gray-800">ITP</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Valabil până la</label>
                  <input type="date" value={itpValidUntil} onChange={(e) => setItpValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
                </div>
                <CostInput label="Cost (RON)" value={itpCost} onChange={setItpCost} />
              </div>
            </div>
          </div>

          {/* Rovinieta */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-[#FCFBF8] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={hasRovinieta} onChange={(e) => setHasRovinieta(e.target.checked)} className="h-5 w-5" />
              <span className="text-sm font-medium text-gray-800">Are rovignetă</span>
            </label>
            {hasRovinieta && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Valabilă până la</label>
                  <input type="date" value={rovinietaValidUntil} onChange={(e) => setRovinietaValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
                </div>
                <CostInput label="Cost (RON)" value={rovinietaCost} onChange={setRovinietaCost} />
              </div>
            )}
          </div>

          {/* CASCO */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-[#FCFBF8] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={hasCasco} onChange={(e) => setHasCasco(e.target.checked)} className="h-5 w-5" />
              <span className="text-sm font-medium text-gray-800">Are CASCO</span>
            </label>
            {hasCasco && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Valabil până la</label>
                  <input type="date" value={cascoValidUntil} onChange={(e) => setCascoValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
                </div>
                <CostInput label="Cost (RON)" value={cascoCost} onChange={setCascoCost} />
              </div>
            )}
          </div>
        </section>

        {/* Leasing */}
        <section className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="mb-4 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Leasing</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 transition hover:bg-gray-50">
            <input type="checkbox" checked={isLeasing} onChange={(e) => setIsLeasing(e.target.checked)} className="h-5 w-5" />
            <span className="text-sm font-medium text-gray-800">Vehicul în leasing</span>
          </label>
          {isLeasing && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Rată lunară</label>
                <div className="relative">
                  <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)}
                    placeholder="Ex: 1500"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-14 text-sm outline-none transition focus:border-gray-500" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">lei</span>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Data ultimei rate</label>
                <input type="date" value={lastRateDate} onChange={(e) => setLastRateDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
              </div>
            </div>
          )}
        </section>

        {/* Butoane */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="w-full rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
            {submitting ? "Se salvează..." : "Salvează modificările"}
          </button>
          <button type="button" onClick={() => router.push("/admin/parc-auto")}
            className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto">
            Renunță
          </button>
        </div>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-red-50">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-red-600">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-extrabold text-gray-900">Șterge vehicul</h2>
              <p className="mt-2 text-sm text-gray-500">
                Ești sigur că vrei să ștergi <span className="font-semibold text-gray-800">{brand} {model}</span> ({registrationNumber})? Această acțiune nu poate fi anulată.
              </p>
            </div>
            <div className="flex gap-3 border-t border-[#E8E5DE] px-6 py-4">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                {deleting ? "Se șterge..." : "Da, șterge"}
              </button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
