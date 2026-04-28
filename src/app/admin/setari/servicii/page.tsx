"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";


type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
  is_active: boolean;
  created_at: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function SetariServiciiPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [name, setName] = useState("");
  const [um, setUm] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadServices = async () => {
    const { data } = await supabase.from("services")
      .select("id, name, um, price_ron, is_active, created_at")
      .order("name", { ascending: true });
    setServices((data as Service[]) || []);
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "administrator") { router.push("/dashboard"); return; }
      await loadServices();
      setLoading(false);
    };
    checkAndLoad();
  }, [router]);

  const resetForm = () => {
    setName(""); setUm(""); setPrice(""); setIsActive(true);
    setEditingId(null); setShowForm(false);
  };

  const openEdit = (svc: Service) => {
    setEditingId(svc.id);
    setName(svc.name); setUm(svc.um);
    setPrice(String(svc.price_ron)); setIsActive(svc.is_active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast("error", "Completează denumirea serviciului."); return; }
    if (!um.trim()) { showToast("error", "Completează unitatea de măsură."); return; }
    if (!price || Number(price) < 0) { showToast("error", "Completează un preț valid."); return; }

    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("services").update({
        name: name.trim(), um: um.trim(), price_ron: Number(price), is_active: isActive,
      }).eq("id", editingId);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("services").insert({
        name: name.trim(), um: um.trim(), price_ron: Number(price), is_active: isActive,
      });
      if (error) { showToast("error", `Eroare: ${error.message}`); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    await loadServices();
    showToast("success", editingId ? "Serviciu actualizat." : "Serviciu adăugat.");
  };

  const handleToggleActive = async (svc: Service) => {
    await supabase.from("services").update({ is_active: !svc.is_active }).eq("id", svc.id);
    await loadServices();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("services").delete().eq("id", id);
    setDeleting(null);
    await loadServices();
    showToast("success", "Serviciu șters.");
  };

  const filteredServices = services.filter((s) =>
    !search.trim() ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.um.toLowerCase().includes(search.toLowerCase())
  );

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#0196ff] sm:h-7 sm:w-7">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 2v4M15 2v4M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0196ff]/10">{renderIcon()}</div>
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
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${
            toast.type === "success" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"
          }`}>
            {toast.type === "success" ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-green-600" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <div className="flex gap-3">
            <button onClick={() => router.push("/admin/setari")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Înapoi la setări
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              + Serviciu nou
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-[#0196ff]/10 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Setări · Devize</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Servicii deviz</h1>
              <p className="mt-2 text-sm text-gray-500">
                Serviciile din care șefii de echipă completează devizul zilnic. Prețul e vizibil doar pentru administrator.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
              {services.filter((s) => s.is_active).length} active
            </span>
          </div>
          <div className="mt-5">
            <input type="text" placeholder="Caută după denumire sau UM..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
          </div>
        </section>

        <div className="mt-6 space-y-4">
          {showForm && (
            <div className="rounded-[22px] border border-[#0196ff]/30 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  {editingId ? "Editează serviciu" : "Serviciu nou"}
                </p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Denumire <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Tencuială interioară"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">UM <span className="text-red-500">*</span></label>
                  <input type="text" value={um} onChange={(e) => setUm(e.target.value)}
                    placeholder="Ex: mp, ml, buc"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Preț (lei/UM) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                      placeholder="Ex: 45.00"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none focus:border-gray-500" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                  </div>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 hover:bg-gray-50">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5" />
                <span className="text-sm font-medium text-gray-800">Serviciu activ (vizibil în deviz)</span>
              </label>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="rounded-xl bg-[#0196ff] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                  {saving ? "Se salvează..." : editingId ? "Salvează modificările" : "Adaugă serviciu"}
                </button>
                <button type="button" onClick={resetForm}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Anulează
                </button>
              </div>
            </div>
          )}

          {filteredServices.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {search ? "Nu există servicii pentru căutarea introdusă." : "Nu există servicii adăugate. Apasă «+ Serviciu nou» pentru a adăuga."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-5 py-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-5">Denumire</div>
                  <div className="col-span-2">UM</div>
                  <div className="col-span-2">Preț / UM</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2 text-right">Acțiuni</div>
                </div>
                {filteredServices.map((svc) => (
                  <div key={svc.id} className="grid grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-4 last:border-b-0">
                    <div className="col-span-5 text-sm font-semibold text-gray-900">{svc.name}</div>
                    <div className="col-span-2 text-sm text-gray-500">{svc.um}</div>
                    <div className="col-span-2 text-sm font-bold text-gray-900">{Number(svc.price_ron).toFixed(2)} lei</div>
                    <div className="col-span-1">
                      <button type="button" onClick={() => handleToggleActive(svc)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${svc.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {svc.is_active ? "Activ" : "Inactiv"}
                      </button>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button type="button" onClick={() => openEdit(svc)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                      <button type="button" onClick={() => handleDelete(svc.id)} disabled={deleting === svc.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                        {deleting === svc.id ? "..." : "Șterge"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 lg:hidden">
                {filteredServices.map((svc) => (
                  <div key={svc.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">{svc.name}</p>
                        <p className="mt-0.5 text-sm text-gray-500">UM: {svc.um} · {Number(svc.price_ron).toFixed(2)} lei/{svc.um}</p>
                      </div>
                      <button type="button" onClick={() => handleToggleActive(svc)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${svc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {svc.is_active ? "Activ" : "Inactiv"}
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => openEdit(svc)}
                        className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                      <button type="button" onClick={() => handleDelete(svc.id)} disabled={deleting === svc.id}
                        className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                        {deleting === svc.id ? "..." : "Șterge"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
 <BottomNav />
    </div>
  );
}
