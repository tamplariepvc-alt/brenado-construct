"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type VehicleCategory = "camion" | "autoutilitara" | "microbuz" | "masina_administrativa";
type VehicleStatus = "activa" | "inactiva" | "in_reparatie";

const categoryIconMap: Record<VehicleCategory, string> = {
  camion: "🚛", autoutilitara: "🚐", microbuz: "🚌", masina_administrativa: "🚗",
};

export default function AdaugaAutoPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

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

    const payload = {
      category,
      brand: brand.trim(),
      model: model.trim(),
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
    };

    const { error } = await supabase.from("vehicles").insert(payload);

    if (error) {
      alert(`A apărut o eroare la salvare: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push("/admin/parc-auto");
  };

  const CostInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="relative mt-3">
      <label className="mb-2 block text-sm font-medium text-gray-700">Cost (RON)</label>
      <div className="relative">
        <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
          defaultValue={value}
          onBlur={(e) => onChange(e.target.value)}
          placeholder="Ex: 450.00"
          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-14 outline-none transition focus:border-black" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">RON</span>
      </div>
    </div>
  );

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
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <p className="text-sm text-gray-500">Parc auto</p>
          <div className="mt-3 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#F8F7F3] text-3xl shadow-sm">
              {categoryIconMap[category]}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Adaugă auto</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">
                Completează datele vehiculului nou și salvează-l direct în parc auto.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {/* Informații generale */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Informații generale</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Categorie auto</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black">
                  <option value="camion">Camion</option>
                  <option value="autoutilitara">Autoutilitară</option>
                  <option value="microbuz">Microbuz</option>
                  <option value="masina_administrativa">Mașină administrativă</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black">
                  <option value="activa">Activă</option>
                  <option value="inactiva">Inactivă</option>
                  <option value="in_reparatie">În reparație</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Marcă</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Ford"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Model</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex: Transit"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Nr. înmatriculare</label>
                <input type="text" value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  placeholder="Ex: B123ABC"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 uppercase outline-none transition focus:border-black" />
              </div>
            </div>
          </section>

          {/* Documente */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Documente și valabilitate</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* RCA */}
              <div className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                <p className="text-sm font-semibold text-gray-800">RCA</p>
                <div className="mt-3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Valabil până la</label>
                  <input type="date" value={rcaValidUntil} onChange={(e) => setRcaValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
                </div>
                <CostInput value={rcaCost} onChange={setRcaCost} />
              </div>

              {/* ITP */}
              <div className="rounded-2xl border border-[#E8E5DE] bg-[#FCFBF8] p-4">
                <p className="text-sm font-semibold text-gray-800">ITP</p>
                <div className="mt-3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Valabil până la</label>
                  <input type="date" value={itpValidUntil} onChange={(e) => setItpValidUntil(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
                </div>
                <CostInput value={itpCost} onChange={setItpCost} />
              </div>
            </div>

            {/* Rovinieta */}
            <div className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={hasRovinieta} onChange={(e) => setHasRovinieta(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-medium text-gray-800">Are rovignetă</span>
              </label>
              {hasRovinieta && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Valabilă până la</label>
                    <input type="date" value={rovinietaValidUntil} onChange={(e) => setRovinietaValidUntil(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Cost (RON)</label>
                    <div className="relative">
                      <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" defaultValue={rovinietaCost} onBlur={(e) => setRovinietaCost(e.target.value)}
                        placeholder="Ex: 28.00"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-14 outline-none transition focus:border-black" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">RON</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CASCO */}
            <div className="mt-4 rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={hasCasco} onChange={(e) => setHasCasco(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-medium text-gray-800">Are CASCO</span>
              </label>
              {hasCasco && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Valabil până la</label>
                    <input type="date" value={cascoValidUntil} onChange={(e) => setCascoValidUntil(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Cost (RON)</label>
                    <div className="relative">
                      <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" defaultValue={cascoCost} onBlur={(e) => setCascoCost(e.target.value)}
                        placeholder="Ex: 1200.00"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-14 outline-none transition focus:border-black" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">RON</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Leasing */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Leasing</h2>
            <div className="mt-5 rounded-[22px] border border-[#E8E5DE] bg-[#FCFBF8] p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={isLeasing} onChange={(e) => setIsLeasing(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-medium text-gray-800">Vehicul în leasing</span>
              </label>
              {isLeasing && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Rată lunară</label>
                    <div className="relative">
                      <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)}
                        placeholder="Ex: 1500"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-14 outline-none transition focus:border-black" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">RON</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Data ultimei rate</label>
                    <input type="date" value={lastRateDate} onChange={(e) => setLastRateDate(e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="w-full rounded-2xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                {submitting ? "Se salvează..." : "Salvează auto"}
              </button>
              <button type="button" onClick={() => router.push("/admin/parc-auto")}
                className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Renunță
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
