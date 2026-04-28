"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Article = {
  id: string;
  article_number: string | null;
  article_code: string | null;
  name: string;
  unit: string | null;
  unit_price: number;
  vat_percent: number;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function SetariMaterialePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [artNumber, setArtNumber] = useState("");
  const [artCode, setArtCode] = useState("");
  const [artName, setArtName] = useState("");
  const [artUnit, setArtUnit] = useState("");
  const [artPrice, setArtPrice] = useState("");
  const [artVat, setArtVat] = useState("21");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadArticles = async () => {
    const { data } = await supabase.from("inventory_articles")
      .select("id, article_number, article_code, name, unit, unit_price, vat_percent")
      .order("name", { ascending: true });
    setArticles((data as Article[]) || []);
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "administrator") { router.push("/dashboard"); return; }
      await loadArticles();
      setLoading(false);
    };
    checkAndLoad();
  }, [router]);

  const resetForm = () => {
    setArtNumber(""); setArtCode(""); setArtName("");
    setArtUnit(""); setArtPrice(""); setArtVat("21");
    setEditingId(null); setShowForm(false);
  };

  const openEdit = (art: Article) => {
    setEditingId(art.id);
    setArtNumber(art.article_number || "");
    setArtCode(art.article_code || "");
    setArtName(art.name);
    setArtUnit(art.unit || "");
    setArtPrice(String(art.unit_price));
    setArtVat(String(art.vat_percent));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!artName.trim()) { showToast("error", "Completează denumirea articolului."); return; }
    if (!artUnit.trim()) { showToast("error", "Completează unitatea de măsură."); return; }
    if (!artPrice || Number(artPrice) < 0) { showToast("error", "Completează un preț valid."); return; }

    setSaving(true);
    const payload = {
      article_number: artNumber.trim() || null,
      article_code: artCode.trim() || null,
      name: artName.trim(),
      unit: artUnit.trim(),
      unit_price: Number(artPrice),
      vat_percent: Number(artVat) || 21,
    };

    if (editingId) {
      const { error } = await supabase.from("inventory_articles").update(payload).eq("id", editingId);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("inventory_articles").insert(payload);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    await loadArticles();
    showToast("success", editingId ? "Articol actualizat." : "Articol adăugat.");
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("inventory_articles").delete().eq("id", id);
    setDeleting(null);
    await loadArticles();
    showToast("success", "Articol șters.");
  };

  const filteredArticles = articles.filter((a) =>
    !search.trim() ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.article_code || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.article_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const renderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-orange-600 sm:h-7 sm:w-7">
      <path d="M4 6h2l1.4 6.5h8.8L18 8H8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-50">{renderIcon()}</div>
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-orange-500" />
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
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              + Articol nou
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-orange-50 sm:h-14 sm:w-14">
              {renderIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Setări · Comenzi</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Articole comenzi</h1>
              <p className="mt-2 text-sm text-gray-500">
                Catalogul de articole disponibile la crearea comenzilor de materiale.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
              {articles.length} articole
            </span>
          </div>
          <div className="mt-5">
            <input type="text" placeholder="Caută după denumire, cod sau număr articol..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
          </div>
        </section>

        <div className="mt-6 space-y-4">
          {showForm && (
            <div className="rounded-[22px] border border-orange-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  {editingId ? "Editează articol" : "Articol nou"}
                </p>
                <div className="h-px flex-1 bg-[#E8E5DE]" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Nr. articol</label>
                  <input type="text" value={artNumber} onChange={(e) => setArtNumber(e.target.value)}
                    placeholder="Ex: 1001"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Cod articol</label>
                  <input type="text" value={artCode} onChange={(e) => setArtCode(e.target.value)}
                    placeholder="Ex: MAT-001"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Denumire <span className="text-red-500">*</span></label>
                  <input type="text" value={artName} onChange={(e) => setArtName(e.target.value)}
                    placeholder="Ex: Ciment Portland 40kg"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">UM <span className="text-red-500">*</span></label>
                  <input type="text" value={artUnit} onChange={(e) => setArtUnit(e.target.value)}
                    placeholder="Ex: buc, kg, sac"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Preț unitar <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" value={artPrice} onChange={(e) => setArtPrice(e.target.value)}
                      placeholder="Ex: 28.50"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none focus:border-gray-500" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">TVA (%)</label>
                  <div className="relative">
                    <input type="number" min="0" step="1" value={artVat} onChange={(e) => setArtVat(e.target.value)}
                      placeholder="21"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-8 text-sm outline-none focus:border-gray-500" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                  {saving ? "Se salvează..." : editingId ? "Salvează modificările" : "Adaugă articol"}
                </button>
                <button type="button" onClick={resetForm}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Anulează
                </button>
              </div>
            </div>
          )}

          {filteredArticles.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {search ? "Nu există articole pentru căutarea introdusă." : "Nu există articole adăugate. Apasă «+ Articol nou» pentru a adăuga."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm lg:block">
                <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-1">Nr.</div>
                  <div className="col-span-2">Cod</div>
                  <div className="col-span-4">Denumire</div>
                  <div className="col-span-1">UM</div>
                  <div className="col-span-2">Preț</div>
                  <div className="col-span-1">TVA</div>
                  <div className="col-span-1 text-right">Acțiuni</div>
                </div>
                {filteredArticles.map((art) => (
                  <div key={art.id} className="grid grid-cols-12 items-center border-b border-[#E8E5DE] px-5 py-3.5 text-sm last:border-b-0">
                    <div className="col-span-1 text-xs text-gray-400">{art.article_number || "-"}</div>
                    <div className="col-span-2 text-xs text-gray-500">{art.article_code || "-"}</div>
                    <div className="col-span-4 break-words font-medium text-gray-900">{art.name}</div>
                    <div className="col-span-1 text-gray-500">{art.unit || "-"}</div>
                    <div className="col-span-2 font-bold text-gray-900">{Number(art.unit_price).toFixed(2)} lei</div>
                    <div className="col-span-1 text-gray-500">{art.vat_percent}%</div>
                    <div className="col-span-1 flex justify-end gap-1.5">
                      <button type="button" onClick={() => openEdit(art)}
                        className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                      <button type="button" onClick={() => handleDelete(art.id)} disabled={deleting === art.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                        {deleting === art.id ? "..." : "Șterge"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 lg:hidden">
                {filteredArticles.map((art) => (
                  <div key={art.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-gray-900">{art.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {art.article_code || "-"} · {art.unit || "-"} · {Number(art.unit_price).toFixed(2)} lei · TVA {art.vat_percent}%
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => openEdit(art)}
                        className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                      <button type="button" onClick={() => handleDelete(art.id)} disabled={deleting === art.id}
                        className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                        {deleting === art.id ? "..." : "Șterge"}
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
