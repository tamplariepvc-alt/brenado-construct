"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "administrator" | "sef_echipa" | "user";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type Project = {
  id: string;
  name: string;
};

type Article = {
  id: string;
  article_number: string | null;
  article_code: string | null;
  name: string;
  unit: string | null;
  unit_price: number;
  vat_percent: number;
};

type OrderItemForm = {
  localId: string;
  article_id: string;
  article_number: string;
  article_code: string;
  article_name: string;
  unit: string;
  unit_price: number;
  vat_percent: number;
  quantity: string;
};

type ToastType = "error" | "success" | "warning";
type Toast = { type: ToastType; message: string } | null;

function generateLocalId() {
  return Math.random().toString(36).slice(2);
}

async function fetchAllArticles() {
  const pageSize = 1000;
  let from = 0;
  let allArticles: Article[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("inventory_articles")
      .select("id, article_number, article_code, name, unit, unit_price, vat_percent")
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allArticles = [...allArticles, ...(data as Article[])];
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allArticles;
}

export default function AdaugaComandaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const isSubmittingRef = useRef(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [orderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [notes, setNotes] = useState("");

  const [articleSearch, setArticleSearch] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([]);

  const [selectedArticleForPopup, setSelectedArticleForPopup] = useState<Article | null>(null);
  const [popupQuantity, setPopupQuantity] = useState("1");

  const showToast = (type: ToastType, message: string, duration = 4000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  const toastColors: Record<ToastType, string> = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-[#0196ff]/30 bg-[#0196ff]/8 text-[#0057b3]",
    warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  };

  const toastIcons: Record<ToastType, JSX.Element> = {
    error: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-red-500" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
    ),
    success: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-[#0196ff]" stroke="currentColor" strokeWidth="2">
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

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles").select("id, full_name, role").eq("id", user.id).single();

      if (profileError || !profileData) { router.push("/login"); return; }

      if (profileData.role !== "administrator" && profileData.role !== "sef_echipa") {
        router.push("/dashboard"); return;
      }

      setProfile(profileData as Profile);

      if (profileData.role === "administrator") {
        const { data: projectsData } = await supabase
          .from("projects").select("id, name").order("created_at", { ascending: false });
        if (projectsData) setProjects(projectsData);
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects } = await supabase
          .from("project_team_leads").select("project_id").eq("user_id", user.id);
        const projectIds = (linkedProjects || []).map((item) => item.project_id);
        if (projectIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects").select("id, name").in("id", projectIds).order("created_at", { ascending: false });
          if (projectsData) setProjects(projectsData);
        }
      }

      const articlesData = await fetchAllArticles();
      if (articlesData) setArticles(articlesData);

      setLoading(false);
    };

    loadData();
  }, [router]);

  const filteredArticles = useMemo(() => {
    const q = articleSearch.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.article_code || "").toLowerCase().includes(q) ||
      (a.article_number || "").toLowerCase().includes(q)
    );
  }, [articles, articleSearch]);

  const openAddArticlePopup = (article: Article) => {
    setSelectedArticleForPopup(article);
    setPopupQuantity("1");
  };

  const closeAddArticlePopup = () => {
    setSelectedArticleForPopup(null);
    setPopupQuantity("1");
  };

  const confirmAddArticle = () => {
    if (!selectedArticleForPopup) return;
    const qty = Number(popupQuantity);
    if (!popupQuantity || Number.isNaN(qty) || qty < 1) {
      showToast("error", "Introdu o cantitate validă.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        localId: generateLocalId(),
        article_id: selectedArticleForPopup.id,
        article_number: selectedArticleForPopup.article_number || "",
        article_code: selectedArticleForPopup.article_code || "",
        article_name: selectedArticleForPopup.name,
        unit: selectedArticleForPopup.unit || "",
        unit_price: Number(selectedArticleForPopup.unit_price || 0),
        vat_percent: Number(selectedArticleForPopup.vat_percent || 21),
        quantity: String(qty),
      },
    ]);
    closeAddArticlePopup();
  };

  const updateItemQuantity = (localId: string, quantity: string) => {
    setItems((prev) => prev.map((item) => item.localId === localId ? { ...item, quantity } : item));
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const subtotal = useMemo(() =>
    items.reduce((sum, item) => sum + item.unit_price * (Number(item.quantity) || 0), 0),
    [items]
  );

  const vatTotal = useMemo(() =>
    items.reduce((sum, item) => sum + item.unit_price * (Number(item.quantity) || 0) * (item.vat_percent / 100), 0),
    [items]
  );

  const totalWithVat = useMemo(() => subtotal + vatTotal, [subtotal, vatTotal]);

  const saveOrder = async (status: "draft" | "asteapta_confirmare") => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { isSubmittingRef.current = false; router.push("/login"); return; }

    if (!selectedProjectId) {
      showToast("error", "Selectează un șantier.");
      isSubmittingRef.current = false;
      return;
    }

    if (items.length === 0) {
      showToast("error", "Adaugă cel puțin un articol în comandă.");
      isSubmittingRef.current = false;
      return;
    }

    const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
    const nextOrderNumber = String((count || 0) + 1).padStart(4, "0");

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: nextOrderNumber,
        created_by: user.id,
        project_id: selectedProjectId,
        order_date: orderDate,
        status,
        subtotal: Number(subtotal.toFixed(2)),
        vat_total: Number(vatTotal.toFixed(2)),
        total_with_vat: Number(totalWithVat.toFixed(2)),
        notes,
      })
      .select()
      .single();

    if (orderError || !orderData) {
      showToast("error", "A apărut o eroare la salvarea comenzii.");
      isSubmittingRef.current = false;
      return;
    }

    const orderItemsRows = items.map((item) => {
      const qty = Number(item.quantity) || 1;
      const lineTotal = item.unit_price * qty;
      const lineTotalWithVat = lineTotal + lineTotal * (item.vat_percent / 100);
      return {
        order_id: orderData.id,
        article_id: item.article_id,
        article_number: item.article_number,
        article_code: item.article_code,
        article_name: item.article_name,
        unit: item.unit,
        unit_price: Number(item.unit_price.toFixed(2)),
        quantity: Number(qty.toFixed(2)),
        line_total: Number(lineTotal.toFixed(2)),
        vat_percent: Number(item.vat_percent.toFixed(2)),
        line_total_with_vat: Number(lineTotalWithVat.toFixed(2)),
      };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsRows);

    if (itemsError) {
      showToast("warning", "Comanda a fost creată, dar articolele nu au putut fi salvate.");
      isSubmittingRef.current = false;
      return;
    }

    showToast(
      "success",
      status === "draft" ? "Comanda a fost salvată pentru mai târziu." : "Comanda a fost trimisă cu succes.",
      2000
    );
    isSubmittingRef.current = false;
    setTimeout(() => router.push("/comenzi"), 1500);
  };

  const handleSaveDraft = async () => {
    if (savingDraft || sendingOrder) return;
    setSavingDraft(true);
    await saveOrder("draft");
    setSavingDraft(false);
  };

  const handleSendOrder = async () => {
    if (savingDraft || sendingOrder) return;
    setSendingOrder(true);
    await saveOrder("asteapta_confirmare");
    setSendingOrder(false);
  };

  const renderOrderIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
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
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain sm:h-11" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderOrderIcon()}</div>
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
      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg ${toastColors[toast.type]}`}>
            {toastIcons[toast.type]}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className="ml-auto shrink-0 text-lg leading-none opacity-50 hover:opacity-80">✕</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button
            onClick={() => router.push("/comenzi")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la comenzi
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50 sm:h-14 sm:w-14">
              {renderOrderIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare comenzi</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Adaugă comandă</h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">Creează o comandă nouă pentru șantierul selectat.</p>
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {/* Informații comandă */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Informații comandă</h2>
              <p className="text-sm text-gray-500">Completează datele generale ale comenzii.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Data comenzii</label>
                <input type="date" value={orderDate} disabled className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-600" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Selectează șantier *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                >
                  <option value="">Selectează șantier</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Observații</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adaugă observații pentru comandă"
                rows={3}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>
          </section>

          {/* Selectează articol — stil deviz */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Selectează articol</h2>
              <p className="text-sm text-gray-500">Caută rapid și adaugă articole în comandă.</p>
            </div>

            <input
              type="text"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="Caută după număr, cod sau denumire articol..."
              className="mb-3 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#0196ff]"
            />

            {/* Listă articole — carduri stil deviz */}
            {articleSearch.trim() && (
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2">
                {filteredArticles.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">Nu există articole găsite.</p>
                ) : (
                  filteredArticles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => openAddArticlePopup(article)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-left transition hover:bg-[#0196ff]/5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{article.name}</p>
                        <p className="text-xs text-gray-400">{article.article_code || "-"} · {article.unit || "-"} · {Number(article.unit_price).toFixed(2)} lei</p>
                      </div>
                      <span className="shrink-0 rounded-xl bg-[#0196ff] px-3 py-1.5 text-xs font-semibold text-white">
                        + Adaugă
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {!articleSearch.trim() && (
              <p className="text-xs text-gray-400">Începe să tastezi pentru a căuta articole.</p>
            )}
          </section>

          {/* Articole selectate */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Articole selectate</h2>
              <p className="text-sm text-gray-500">Ajustează cantitățile și verifică valorile.</p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500">Nu ai adăugat încă niciun articol în comandă.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const lineTotal = item.unit_price * qty;

                  return (
                    <div
                      key={item.localId}
                      className="rounded-2xl border border-[#E8E5DE] bg-[#F8F7F3] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Număr + denumire — wrap complet */}
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0196ff]/10 text-[11px] font-bold text-[#0196ff]">
                              {index + 1}
                            </span>
                            <p className="text-sm font-semibold text-[#0196ff] break-words">{item.article_name}</p>
                          </div>
                          <p className="mt-1 pl-7 text-xs text-gray-400">{item.article_code || "-"} · {item.unit || "-"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.localId)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-500 transition hover:bg-red-100"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 pl-7">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Cantitate</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.localId, e.target.value)}
                            onBlur={() => {
                              if (!item.quantity || Number(item.quantity) < 1) {
                                updateItemQuantity(item.localId, "1");
                              }
                            }}
                            className="h-8 w-20 rounded-xl border border-gray-300 bg-white px-2 text-center text-sm outline-none focus:border-[#0196ff]"
                          />
                          <span className="text-xs text-gray-400">{item.unit}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-400">Total</p>
                          <p className="text-sm font-bold text-gray-900">{lineTotal.toFixed(2)} lei</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Total comandă */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Total comandă</h2>
              <p className="text-sm text-gray-500">Verifică valorile înainte de salvare sau trimitere.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <p className="text-sm text-gray-500">Subtotal articole</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{subtotal.toFixed(2)} lei</p>
              </div>
              <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <p className="text-sm text-gray-500">TVA</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{vatTotal.toFixed(2)} lei</p>
              </div>
              <div className="rounded-2xl bg-[#0196ff] p-4 text-white">
                <p className="text-sm text-white/80">Total cu TVA</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{totalWithVat.toFixed(2)} lei</p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || sendingOrder}
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                {savingDraft ? "Se salvează..." : "Salvează comanda"}
              </button>
              <span className="mt-1 text-xs text-gray-500">salvează pentru mai târziu</span>
            </div>
            <button
              type="button"
              onClick={handleSendOrder}
              disabled={savingDraft || sendingOrder}
              className="rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {sendingOrder ? "Se trimite..." : "Trimite comanda"}
            </button>
          </div>
        </div>

        {/* POPUP ADAUGĂ ARTICOL */}
        {selectedArticleForPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Adaugă articol</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Denumire</p>
                  <p className="mt-1 text-sm font-semibold text-[#0196ff] break-words leading-snug">
                    {selectedArticleForPopup.name}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Cod</p>
                    <p className="text-sm font-medium text-gray-700">{selectedArticleForPopup.article_code || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">U.M.</p>
                    <p className="text-sm font-semibold text-gray-700">{selectedArticleForPopup.unit || "-"}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Preț unitar</p>
                    <p className="text-sm font-semibold text-gray-900">{Number(selectedArticleForPopup.unit_price).toFixed(2)} lei</p>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs text-gray-500">Cantitate</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={popupQuantity}
                      onChange={(e) => setPopupQuantity(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-sm outline-none focus:border-[#0196ff]"
                    />
                  </div>
                </div>

                {/* Preview valoare */}
                {popupQuantity && Number(popupQuantity) > 0 && (
                  <div className="rounded-2xl bg-[#0196ff]/8 border border-[#0196ff]/20 px-4 py-2.5">
                    <p className="text-xs text-[#0057b3]">Valoare estimată</p>
                    <p className="text-base font-bold text-[#0196ff]">
                      {(Number(selectedArticleForPopup.unit_price) * Number(popupQuantity)).toFixed(2)} lei
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeAddArticlePopup}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Renunță
                </button>
                <button
                  type="button"
                  onClick={confirmAddArticle}
                  className="flex-1 rounded-xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Confirmă
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
