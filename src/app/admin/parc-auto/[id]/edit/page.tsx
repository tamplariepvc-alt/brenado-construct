"use client";

import Image from "next/image";
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
};

const categoryLabels: Record<VehicleCategory, string> = {
  camion: "Camion",
  autoutilitara: "Autoutilitară",
  microbuz: "Microbuz",
  masina_administrativa: "Mașină administrativă",
};

export default function EditAutoPage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    const loadVehicle = async () => {
      setLoading(true);

      const { data, error } = await supabase
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
          status
        `)
        .eq("id", vehicleId)
        .single();

      if (error || !data) {
        router.push("/admin/parc-auto");
        return;
      }

      const vehicle = data as Vehicle;

      setCategory(vehicle.category);
      setBrand(vehicle.brand || "");
      setModel(vehicle.model || "");
      setRegistrationNumber(vehicle.registration_number || "");
      setRcaValidUntil(vehicle.rca_valid_until || "");
      setItpValidUntil(vehicle.itp_valid_until || "");
      setIsLeasing(Boolean(vehicle.is_leasing));
      setMonthlyRate(
        vehicle.monthly_rate != null ? String(Number(vehicle.monthly_rate)) : ""
      );
      setLastRateDate(vehicle.last_rate_date || "");
      setStatus(vehicle.status);

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

    if (rcaExpired || itpExpired) {
      return "doc_expirate";
    }

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

  const handleSubmit = async () => {
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

    if (isLeasing) {
      if (!monthlyRate || Number(monthlyRate) <= 0) {
        alert("Completează rata lunară pentru leasing.");
        return;
      }

      if (!lastRateDate) {
        alert("Selectează data ultimei rate.");
        return;
      }
    }

    setSubmitting(true);

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

    const { error } = await supabase
      .from("vehicles")
      .update(payload)
      .eq("id", vehicleId);

    if (error) {
      alert(`A apărut o eroare la salvare: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/admin/parc-auto");
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur vrei să ștergi acest vehicul?"
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicleId);

    if (error) {
      alert(`A apărut o eroare la ștergere: ${error.message}`);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    router.push("/admin/parc-auto");
  };

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={150}
            height={48}
            className="h-11 w-auto object-contain"
          />

          <button
            onClick={() => router.push("/admin/parc-auto")}
            className="w-full max-w-xl rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la parc auto
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Administrare vehicul</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Editează auto
              </h1>
              <p className="mt-3 text-sm text-gray-500 sm:text-base">
                Modifică datele vehiculului din parc auto.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${computedStatusClasses}`}
              >
                {computedStatusLabel}
              </span>

              {isLeasing && (
                <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Leasing
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
                Categorie
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {categoryLabels[category]}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
                Nr. auto
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {registrationNumber || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
                RCA
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatDate(rcaValidUntil || null)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
                ITP
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {formatDate(itpValidUntil || null)}
              </p>
            </div>
          </div>
        </section>

        {isLeasing && (
          <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Detalii leasing
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Valori calculate automat după rata lunară și data ultimei rate.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E8E5DE] bg-purple-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-purple-500">
                  Rată lunară
                </p>
                <p className="mt-2 text-lg font-bold text-purple-700">
                  {Number(monthlyRate || 0).toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-2xl border border-[#E8E5DE] bg-purple-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-purple-500">
                  Luni rămase
                </p>
                <p className="mt-2 text-lg font-bold text-purple-700">
                  {monthsRemaining}
                </p>
              </div>

              <div className="rounded-2xl border border-[#E8E5DE] bg-purple-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-purple-500">
                  Rămas de plată
                </p>
                <p className="mt-2 text-lg font-bold text-purple-700">
                  {remainingLeasingValue.toFixed(2)} lei
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Informații vehicul
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Actualizează câmpurile de mai jos și salvează modificările.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Categorie auto
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              >
                <option value="camion">Camion</option>
                <option value="autoutilitara">Autoutilitară</option>
                <option value="microbuz">Microbuz</option>
                <option value="masina_administrativa">Mașină administrativă</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status manual
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
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
                placeholder="Ex: Ford"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
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
                placeholder="Ex: Transit"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nr. înmatriculare
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) =>
                  setRegistrationNumber(e.target.value.toUpperCase())
                }
                placeholder="Ex: B123ABC"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 uppercase outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                RCA valabil până la
              </label>
              <input
                type="date"
                value={rcaValidUntil}
                onChange={(e) => setRcaValidUntil(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
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
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-4">
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
          </div>

          {isLeasing && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  placeholder="Ex: 1500"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
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
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Se salvează..." : "Salvează modificările"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {deleting ? "Se șterge..." : "Șterge auto"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/parc-auto")}
              className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Renunță
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}