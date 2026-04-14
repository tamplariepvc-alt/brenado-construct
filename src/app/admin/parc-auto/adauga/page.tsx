"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory =
  | "camion"
  | "autoutilitara"
  | "microbuz"
  | "masina_administrativa";

type VehicleStatus = "activa" | "inactiva" | "in_reparatie";

export default function AdaugaAutoPage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

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

    if (hasRovinieta && !rovinietaValidUntil) {
      alert("Completeaza data rovinietei.");
      return;
    }

    if (hasCasco && !cascoValidUntil) {
      alert("Completeaza data Casco.");
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

      has_rovinieta: hasRovinieta,
      rovinieta_valid_until: hasRovinieta ? rovinietaValidUntil || null : null,

      has_casco: hasCasco,
      casco_valid_until: hasCasco ? cascoValidUntil || null : null,

      is_leasing: isLeasing,
      monthly_rate: isLeasing ? Number(monthlyRate || 0) : null,
      last_rate_date: isLeasing ? lastRateDate || null : null,

      status,
    };

    const { error } = await supabase.from("vehicles").insert(payload);

    if (error) {
      alert(`A aparut o eroare la salvare: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/admin/parc-auto");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Adauga auto</h1>
            <p className="text-sm text-gray-600">
              Completeaza datele vehiculului nou din parc auto.
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
                Status
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
                checked={hasRovinieta}
                onChange={(e) => setHasRovinieta(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-sm font-medium text-gray-800">
                Rovinieta
              </span>
            </label>
          </div>

          {hasRovinieta && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Rovinieta valabil pana la
              </label>
              <input
                type="date"
                value={rovinietaValidUntil}
                onChange={(e) => setRovinietaValidUntil(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          )}

          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={hasCasco}
                onChange={(e) => setHasCasco(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-sm font-medium text-gray-800">
                Casco
              </span>
            </label>
          </div>

          {hasCasco && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Casco valabil pana la
              </label>
              <input
                type="date"
                value={cascoValidUntil}
                onChange={(e) => setCascoValidUntil(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          )}

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
              {submitting ? "Se salveaza..." : "Salveaza auto"}
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