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
        alert("Completeaza rata lunara pentru leasing.");
        return;
      }

      if (!lastRateDate) {
        alert("Selecteaza data ultimei rate.");
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
      alert(`A aparut o eroare la salvare: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/admin/parc-auto");
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Sigur vrei sa stergi acest vehicul?"
    );

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

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Editeaza auto</h1>
            <p className="text-sm text-gray-600">
              Modifica datele vehiculului din parc auto.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/parc-auto")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Inapoi la parc auto
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow md:p-6">
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Status afisat</p>
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${computedStatusClasses}`}
              >
                {computedStatusLabel}
              </span>
            </div>

            {isLeasing && (
              <div className="text-left sm:text-right">
                <p className="text-sm font-medium text-gray-500">
                  Leasing ramas
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {monthsRemaining} luni
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {remainingLeasingValue.toFixed(2)} lei
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Categorie auto
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
              >
                <option value="camion">Camion</option>
                <option value="autoutilitara">Autoutilitara</option>
                <option value="microbuz">Microbuz</option>
                <option value="masina_administrativa">Masina administrativa</option>
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
                placeholder="Ex: Ford"
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
                placeholder="Ex: Transit"
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
                placeholder="Ex: B123ABC"
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
                  placeholder="Ex: 1500"
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Se salveaza..." : "Salveaza modificarile"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {deleting ? "Se sterge..." : "Sterge auto"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/parc-auto")}
              className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}