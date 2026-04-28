"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const [items, setItems] = useState<OrderItemForm[]>([{
    localId: generateLocalId(), article_id: "", article_number: "", article_code: "",
    article_name: "", unit: "", unit_price: 0, vat_percent: 21, quantity: "",
  }]);

  // Picker deviz-style
  const [pickerItemIndex, setPickerItemIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const showToast = (type: ToastType, message: string, duration = 4000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  const toastColors: Record<ToastType, string> = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-[#0196ff]/30 bg-[#0196ff]/8 text-[#0057b3]",
    warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  };

  const toastIcons: Record<ToastType, React.ReactElement> = {
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
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.article_code || "").toLowerCase().includes(q) ||
      (a.article_number || "").toLowerCase().includes(q)
    );
  }, [articles, pickerSearch]);

  // Deviz-style picker helpers
  const openPicker = (index: number) => { setPickerItemIndex(index); setPickerSearch(""); };
  const closePicker = () => { setPickerItemIndex(null); setPickerSearch(""); };
  const selectArticle = (article: Article) => {
    if (pickerItemIndex === null) return;
    setItems((prev) => {
      const next = [...prev];
      next[pickerItemIndex] = {
        ...next[pickerItemIndex],
        article_id: article.id,
        article_number: article.article_number || "",
        article_code: article.article_code || "",
        article_name: article.name,
        unit: article.unit || "",
        unit_price: Number(article.unit_price || 0),
        vat_percent: Number(article.vat_percent || 21),
      };
      return next;
    });
    closePicker();
  };

  const addLine = () => setItems((prev) => [...prev, {
    localId: generateLocalId(), article_id: "", article_number: "", article_code: "",
    article_name: "", unit: "", unit_price: 0, vat_percent: 21, quantity: "",
  }]);

  const removeLine = (localId: string) => setItems((prev) => prev.filter((item) => item.localId !== localId));



  const updateItemQuantity = (localId: string, quantity: string) => {
    setItems((prev) => prev.map((item) => item.localId === localId ? { ...item, quantity } : item));
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
      {/* PICKER ARTICOL — deviz style bottom sheet */}
      {pickerItemIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closePicker}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <p className="text-base font-bold text-gray-900">Alege articol</p>
              <button type="button" onClick={closePicker}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 hover:bg-gray-200">
                ✕
              </button>
            </div>

            <div className="px-4 pb-2">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Caută după cod sau denumire..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#0196ff]"
              />
            </div>

            <div className="max-h-72 overflow-y-auto px-4 pb-6">
              {filteredArticles.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Niciun articol găsit.</p>
              ) : (
                <div className="space-y-1">
                  {filteredArticles.map((article) => {
                    const isSelected = pickerItemIndex !== null && items[pickerItemIndex]?.article_id === article.id;
                    return (
                      <button key={article.id} type="button" onClick={() => selectArticle(article)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
                          isSelected ? "bg-[#0196ff] text-white" : "hover:bg-gray-50"
                        }`}>
                        <div className="min-w-0 flex-1">
                          <span className={`block text-sm font-medium leading-snug break-words ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {article.name}
                          </span>
                          <span className={`text-xs ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                            {article.article_code || "-"}
                          </span>
                        </div>
                        <span className={`shrink-0 text-xs ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                          {article.unit} · {Number(article.unit_price).toFixed(2)} lei
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}}
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

          {/* Articole comandă — deviz style */}
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Articole comandă</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">{items.length} {items.length === 1 ? "articol" : "articole"}</p>
              </div>
              <button type="button" onClick={addLine}
                className="rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                + Adaugă
              </button>
            </div>

            <div className="divide-y divide-[#F0EEE9]">
              {items.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const lineTotal = item.unit_price * qty;
                const hasArticle = Boolean(item.article_id);

                return (
                  <div key={item.localId} className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
                        {index + 1}
                      </span>
                      <button type="button" onClick={() => openPicker(index)}
                        className={`flex flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          hasArticle ? "border-[#0196ff]/30 bg-[#0196ff]/5" : "border-gray-200 bg-[#F8F7F3]"
                        }`}>
                        <span className={`truncate font-medium ${hasArticle ? "text-[#0057b3]" : "text-gray-400"}`}>
                          {hasArticle ? item.article_name : "Alege articol..."}
                        </span>
                        {hasArticle && (
                          <span className="shrink-0 text-xs text-[#0196ff]">{item.unit}</span>
                        )}
                      </button>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeLine(item.localId)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-400 hover:bg-red-100">
                          ×
                        </button>
                      )}
                    </div>

                    {hasArticle && (
                      <div className="mt-2 flex items-center gap-3 pl-8">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400">Cant.</label>
                          <input
                            type="number" min="1" step="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.localId, e.target.value)}
                            onBlur={() => {
                              if (!item.quantity || Number(item.quantity) < 1) updateItemQuantity(item.localId, "1");
                            }}
                            placeholder="0"
                            className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0196ff]"
                          />
                          <span className="text-xs font-medium text-gray-500">{item.unit}</span>
                        </div>
                        {lineTotal > 0 && (
                          <span className="ml-auto text-sm font-bold text-[#0196ff]">{lineTotal.toFixed(2)} lei</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-[#E8E5DE] px-5 py-4">
              <p className="text-sm font-semibold text-gray-700">Total (fără TVA)</p>
              <p className="text-xl font-extrabold text-[#0196ff]">{subtotal.toFixed(2)} lei</p>
            </div>
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


      </main>
    </div>
  );
}
