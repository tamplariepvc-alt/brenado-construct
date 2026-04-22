"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type OrderDetails = {
  id: string;
  project_id: string;
  created_by: string;
  order_date: string;
  status: string;
  subtotal: number;
  vat_total: number;
  total_with_vat: number;
  notes: string | null;
};

type OrderItemForm = {
  id?: string;
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

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allArticles = [...allArticles, ...(data as Article[])];

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allArticles;
}

export default function EditareComandaPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);

  const isSubmittingRef = useRef(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [orderDate, setOrderDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([]);

  const [selectedArticleForPopup, setSelectedArticleForPopup] =
    useState<Article | null>(null);
  const [popupQuantity, setPopupQuantity] = useState("1");

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        router.push("/login");
        return;
      }

      if (
        profileData.role !== "administrator" &&
        profileData.role !== "sef_echipa"
      ) {
        router.push("/dashboard");
        return;
      }

      setProfile(profileData as Profile);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, project_id, created_by, order_date, status, subtotal, vat_total, total_with_vat, notes"
        )
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        router.push("/comenzi");
        return;
      }

      if (orderData.status !== "draft") {
        router.push(`/comenzi/${orderId}`);
        return;
      }

      if (
        profileData.role === "sef_echipa" &&
        orderData.created_by !== user.id
      ) {
        router.push("/comenzi");
        return;
      }

      if (profileData.role === "administrator") {
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, name")
          .order("created_at", { ascending: false });

        if (projectsData) {
          setProjects(projectsData);
        }
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects } = await supabase
          .from("project_team_leads")
          .select("project_id")
          .eq("user_id", user.id);

        const projectIds = (linkedProjects || []).map((item) => item.project_id);

        if (projectIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", projectIds)
            .order("created_at", { ascending: false });

          if (projectsData) {
            setProjects(projectsData);
          }
        }
      }

      const articlesData = await fetchAllArticles();

      if (articlesData) {
        setArticles(articlesData);
      }

      const { data: itemsData } = await supabase
        .from("order_items")
        .select(
          "id, article_id, article_number, article_code, article_name, unit, unit_price, vat_percent, quantity"
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      setOrderDate(orderData.order_date);
      setSelectedProjectId(orderData.project_id);
      setNotes(orderData.notes || "");

      if (itemsData) {
        setItems(
          itemsData.map((item) => ({
            id: item.id,
            localId: generateLocalId(),
            article_id: item.article_id,
            article_number: item.article_number || "",
            article_code: item.article_code || "",
            article_name: item.article_name,
            unit: item.unit || "",
            unit_price: Number(item.unit_price || 0),
            vat_percent: Number(item.vat_percent || 21),
            quantity: String(Number(item.quantity || 1)),
          }))
        );
      }

      setLoading(false);
    };

    loadData();
  }, [orderId, router]);

  const filteredArticles = useMemo(() => {
    const q = articleSearch.trim().toLowerCase();
    if (!q) return articles;

    return articles.filter((article) => {
      return (
        article.name.toLowerCase().includes(q) ||
        (article.article_code || "").toLowerCase().includes(q) ||
        (article.article_number || "").toLowerCase().includes(q)
      );
    });
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
      alert("Introdu o cantitate validă.");
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
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, quantity } : item
      )
    );
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      return sum + item.unit_price * qty;
    }, 0);
  }, [items]);

  const vatTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      return sum + item.unit_price * qty * (item.vat_percent / 100);
    }, 0);
  }, [items]);

  const totalWithVat = useMemo(() => subtotal + vatTotal, [subtotal, vatTotal]);

  const saveOrder = async (status: "draft" | "asteapta_confirmare") => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    if (!selectedProjectId) {
      alert("Selectează un șantier.");
      isSubmittingRef.current = false;
      return;
    }

    if (items.length === 0) {
      alert("Adaugă cel puțin un articol în comandă.");
      isSubmittingRef.current = false;
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        project_id: selectedProjectId,
        order_date: orderDate,
        status,
        subtotal: Number(subtotal.toFixed(2)),
        vat_total: Number(vatTotal.toFixed(2)),
        total_with_vat: Number(totalWithVat.toFixed(2)),
        notes,
      })
      .eq("id", orderId);

    if (orderError) {
      alert("A apărut o eroare la actualizarea comenzii.");
      isSubmittingRef.current = false;
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) {
      alert(
        "Comanda a fost actualizată, dar liniile vechi nu au putut fi șterse."
      );
      isSubmittingRef.current = false;
      return;
    }

    const orderItemsRows = items.map((item) => {
      const qty = Number(item.quantity) || 1;
      const lineTotal = item.unit_price * qty;
      const lineTotalWithVat =
        lineTotal + lineTotal * (item.vat_percent / 100);

      return {
        order_id: orderId,
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

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsError) {
      alert(
        "Comanda a fost actualizată, dar articolele nu au putut fi salvate."
      );
      isSubmittingRef.current = false;
      return;
    }

    alert(
      status === "draft"
        ? "Draftul a fost actualizat."
        : "Comanda a fost trimisă cu succes."
    );

    isSubmittingRef.current = false;
    router.push("/comenzi");
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <path
        d="M4 6h2l1.4 6.5h8.8L18 8H8.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );

  if (loading) {
    return <div className="p-6">Se încarcă draftul...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
            />
          </div>

          <button
            onClick={() => router.push(`/comenzi/${orderId}`)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la detaliu comandă
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
              <p className="text-sm text-gray-500">Editare comandă</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Editează comandă draft
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                Modifică articolele și trimite comanda când este gata.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Informații comandă
              </h2>
              <p className="text-sm text-gray-500">
                Actualizează datele generale ale draftului.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data comenzii
                </label>
                <input
                  type="date"
                  value={orderDate}
                  disabled
                  className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Selectează șantier *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                >
                  <option value="">Selectează șantier</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Observații
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adaugă observații pentru comandă"
                rows={3}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Selectează articol
              </h2>
              <p className="text-sm text-gray-500">
                Caută și adaugă articole noi în draft.
              </p>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                placeholder="Caută după număr, cod sau denumire articol"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />

              <p className="mt-2 text-xs text-gray-500">
                Derulează în listă pentru a vedea mai multe articole sau caută după nume sau cod.
              </p>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[#E8E5DE]">
              <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-4 py-3 text-xs font-semibold text-gray-600">
                <div className="col-span-3">Cod</div>
                <div className="col-span-6">Denumire</div>
                <div className="col-span-3 text-right">Acțiune</div>
              </div>

              {filteredArticles.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500">
                  Nu există articole găsite.
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="col-span-3 break-words text-gray-600">
                      {article.article_code || "-"}
                    </div>

                    <div className="col-span-6 break-words font-medium text-[#0196ff]">
                      {article.name}
                    </div>

                    <div className="col-span-3 text-right">
                      <button
                        type="button"
                        onClick={() => openAddArticlePopup(article)}
                        className="rounded-xl bg-[#0196ff] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        Adaugă
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Articole selectate
              </h2>
              <p className="text-sm text-gray-500">
                Modifică cantitățile sau elimină articolele existente.
              </p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu ai adăugat încă niciun articol în comandă.
              </p>
            ) : (
              <>
                <div className="hidden lg:block overflow-hidden rounded-2xl border border-[#E8E5DE]">
                  <div className="grid grid-cols-12 border-b bg-[#F8F7F3] px-4 py-3 text-sm font-semibold text-gray-700">
                    <div className="col-span-1">Nr.</div>
                    <div className="col-span-2">Cod</div>
                    <div className="col-span-4">Denumire</div>
                    <div className="col-span-1">Qty</div>
                    <div className="col-span-2 text-right">Val. (lei)</div>
                    <div className="col-span-2 text-center"></div>
                  </div>

                  {items.map((item, index) => {
                    const qty = Number(item.quantity) || 0;
                    const lineTotal = item.unit_price * qty;

                    return (
                      <div
                        key={item.localId}
                        className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="col-span-1 font-semibold text-gray-900">
                          {index + 1}
                        </div>

                        <div className="col-span-2 break-words text-gray-600">
                          {item.article_code || "-"}
                        </div>

                        <div className="col-span-4 break-words font-medium text-[#0196ff]">
                          {item.article_name}
                        </div>

                        <div className="col-span-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(item.localId, e.target.value)
                            }
                            onBlur={() => {
                              if (!item.quantity || Number(item.quantity) < 1) {
                                updateItemQuantity(item.localId, "1");
                              }
                            }}
                            className="h-9 w-16 rounded-xl border border-gray-300 px-2 text-center text-sm"
                          />
                        </div>

                        <div className="col-span-2 text-right font-semibold text-gray-900">
                          {lineTotal.toFixed(2)}
                        </div>

                        <div className="col-span-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.localId)}
                            className="text-lg font-bold leading-none text-red-600"
                            aria-label="Șterge articol"
                            title="Șterge articol"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 lg:hidden">
                  {items.map((item, index) => {
                    const qty = Number(item.quantity) || 0;
                    const lineTotal = item.unit_price * qty;

                    return (
                      <div
                        key={item.localId}
                        className="rounded-2xl border border-[#E8E5DE] bg-gray-50 p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Nr.
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {index + 1}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.localId)}
                            className="text-lg font-bold leading-none text-red-600"
                            aria-label="Șterge articol"
                            title="Șterge articol"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mb-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                            Cod
                          </p>
                          <p className="mt-1 text-sm text-gray-700">
                            {item.article_code || "-"}
                          </p>
                        </div>

                        <div className="mb-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                            Denumire
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#0196ff]">
                            {item.article_name}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Qty
                            </p>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQuantity(item.localId, e.target.value)
                              }
                              onBlur={() => {
                                if (!item.quantity || Number(item.quantity) < 1) {
                                  updateItemQuantity(item.localId, "1");
                                }
                              }}
                              className="mt-1 h-9 w-full rounded-xl border border-gray-300 px-2 text-center text-sm"
                            />
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                              Valoare
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {lineTotal.toFixed(2)} lei
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Total comandă
              </h2>
              <p className="text-sm text-gray-500">
                Verifică valorile actualizate înainte de salvare.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <p className="text-sm text-gray-500">Subtotal articole</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  {subtotal.toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <p className="text-sm text-gray-500">TVA 21%</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  {vatTotal.toFixed(2)} lei
                </p>
              </div>

              <div className="rounded-2xl bg-[#0196ff] p-4 text-white">
                <p className="text-sm text-white/80">Total cu TVA</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {totalWithVat.toFixed(2)} lei
                </p>
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
              <span className="mt-1 text-xs text-gray-500">
                salvează pentru mai târziu
              </span>
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

        {selectedArticleForPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-[24px] border border-[#E8E5DE] bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">
                Adaugă articol
              </h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Cod</p>
                    <p className="text-sm font-medium break-words">
                      {selectedArticleForPopup.article_code || "-"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">U.M.</p>
                    <p className="text-sm font-semibold">
                      {selectedArticleForPopup.unit || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Denumire</p>
                  <p className="text-sm font-semibold text-[#0196ff] break-words">
                    {selectedArticleForPopup.name}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Preț unitar</p>
                    <p className="text-sm font-semibold">
                      {Number(selectedArticleForPopup.unit_price).toFixed(2)} lei
                    </p>
                  </div>

                  <div className="w-24">
                    <label className="mb-1 block text-xs text-gray-500">
                      Cantitate
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={popupQuantity}
                      onChange={(e) => setPopupQuantity(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
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