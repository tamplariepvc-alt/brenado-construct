"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ToastType = "error" | "success" | "warning";
type Toast = { type: ToastType; message: string; } | null;

export default function AdaugaProiectPage() {
  const router = useRouter();

  const [nume, setNume] = useState("");
  const [beneficiar, setBeneficiar] = useState("");
  const [locatie, setLocatie] = useState("");
  const [tip, setTip] = useState("");
  const [grupa, setGrupa] = useState("");
  const [bugetRon, setBugetRon] = useState("");
  const [dataStart, setDataStart] = useState("");
  const [termen, setTermen] = useState("");
  const [status, setStatus] = useState("in_asteptare");

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile) { router.push("/login"); return; }
      const allowedRoles = ["administrator", "cont_tehnic", "project_manager"];
      if (!allowedRoles.includes(profile.role)) { router.push("/dashboard"); return; }
    };
    checkAccess();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nume.trim() || !beneficiar.trim() || !locatie.trim() || !tip.trim() || !grupa || !bugetRon || !dataStart || !termen || !status) {
      showToast("error", "Completează toate câmpurile obligatorii, inclusiv bugetul.");
      return;
    }

    if (Number(bugetRon) < 0) {
      showToast("error", "Bugetul nu poate fi negativ.");
      return;
    }

    setLoading(true);

    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true });

    const nextCostCenterCode = `CC-${String((count || 0) + 1).padStart(4, "0")}`;

    const { error: projectError } = await supabase
      .from("projects")
      .insert({
        name: nume.trim(),
        beneficiary: beneficiar.trim(),
        project_location: locatie.trim(),
        project_type: tip.trim(),
        project_group: grupa,
        budget_ron: Number(bugetRon),
        start_date: dataStart,
        execution_deadline: termen,
        status,
        is_cost_center: true,
        cost_center_code: nextCostCenterCode,
      });

    if (projectError) {
      showToast("error", "A apărut o eroare la salvarea proiectului.");
      setLoading(false);
      return;
    }

    setLoading(false);
    showToast("success", "Proiect salvat cu succes!");
    setTimeout(() => router.push("/dashboard"), 1200);
  };

  const toastColors = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-green-300 bg-green-50 text-green-800",
    warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  };

  const toastIcons = {
    error: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
    ),
    success: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-500" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-yellow-500" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      </svg>
    ),
  };

  const renderProjectIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="10" width="7" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg backdrop-blur ${toastColors[toast.type]}`}>
            {toastIcons[toast.type]}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)}
              className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button type="button" onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderProjectIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare proiecte</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Adaugă proiect</h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">Completează datele proiectului.</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-blue-50">{renderProjectIcon()}</div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Informații proiect</h2>
                <p className="text-sm text-gray-500">Datele generale ale proiectului.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Nume proiect *</label>
                <input type="text" value={nume} onChange={(e) => setNume(e.target.value)}
                  placeholder="Introdu numele proiectului"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Beneficiar *</label>
                <input type="text" value={beneficiar} onChange={(e) => setBeneficiar(e.target.value)}
                  placeholder="Introdu beneficiarul"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Locație proiect *</label>
                <input type="text" value={locatie} onChange={(e) => setLocatie(e.target.value)}
                  placeholder="Introdu locația proiectului"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Tip proiect *</label>
                <input type="text" value={tip} onChange={(e) => setTip(e.target.value)}
                  placeholder="Introdu tipul proiectului"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Selectează grupa *</label>
                <select value={grupa} onChange={(e) => setGrupa(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black">
                  <option value="">Selectează grupa</option>
                  <option value="brenado_construct">BRENADO CONSTRUCT</option>
                  <option value="brenado_mentenanta">BRENADO MENTENANȚĂ</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Buget (RON) *</label>
                <input type="number" step="0.01" min="0" value={bugetRon} onChange={(e) => setBugetRon(e.target.value)}
                  placeholder="Introdu bugetul proiectului"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Planificare și status</h2>
              <p className="text-sm text-gray-500">Setează perioada și starea inițială a proiectului.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Data de început *</label>
                <input type="date" value={dataStart} onChange={(e) => setDataStart(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Termen de execuție *</label>
                <input type="date" value={termen} onChange={(e) => setTermen(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status proiect *</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black">
                  <option value="in_asteptare">În așteptare</option>
                  <option value="in_lucru">În lucru</option>
                  <option value="finalizat">Finalizat</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={loading}
              className="rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
              {loading ? "Se salvează..." : "Salvează proiect"}
            </button>
            <button type="button" onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Renunță
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
