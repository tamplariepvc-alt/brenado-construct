"use client";

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

function generateLocalId() {
  return Math.random().toString(36).slice(2);
}

export default function AdaugaComandaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);

  const isSubmittingRef = useRef(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [orderDate] = useState(() => new Date().toISOString().split("T")[0]);
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

      const { data: articlesData } = await supabase
        .from("inventory_articles")
        .select("id, article_number, article_code, name, unit, unit_price, vat_percent")
        .order("name", { ascending: true });

      if (articlesData) {
        setArticles(articlesData as Article[]);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      isSubmittingRef.current = false;
      router.push("/login");
      return;
    }

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

    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

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
      alert("A apărut o eroare la salvarea comenzii.");
      isSubmittingRef.current = false;
      return;
    }

    const orderItemsRows = items.map((item) => {
      const qty = Number(item.quantity) || 1;
      const lineTotal = item.unit_price * qty;
      const lineTotalWithVat =
        lineTotal + lineTotal * (item.vat_percent / 100);

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

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsError) {
      alert("Comanda a fost creată, dar articolele nu au putut fi salvate.");
      isSubmittingRef.current = false;
      return;
    }

    alert(
      status === "draft"
        ? "Comanda a fost salvată pentru mai târziu."
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

  if (loading) {
    return <div className="p-6">Se încarcă formularul...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Adaugă comandă</h1>
            <p className="text-sm text-gray-600">
              Creează o comandă nouă pentru șantierul selectat.
            </p>
          </div>

          <button
            onClick={() => router.push("/comenzi")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la comenzi
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Informații comandă</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data comenzii
                </label>
                <input
                  type="date"
                  value={orderDate}
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Selectează șantier *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Selectează articol</h2>

            <div className="mb-4">
              <input
                type="text"
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                placeholder="Caută după număr, cod sau denumire articol"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
			  
			  <p className="mt-2 text-xs text-gray-500">
  Derulează în listă pentru a vedea mai multe articole sau caută după nume sau cod.
</p>
			  
            </div>

            <div className="max-h-75 overflow-y-auto rounded-xl border border-gray-200">
              <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
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
                    className="grid grid-cols-12 items-center border-b px-4 py-2 text-xs last:border-b-0"
                  >
                    <div className="col-span-3 break-words">
                      {article.article_code || "-"}
                    </div>

                    <div className="col-span-6 break-words text-[#0196ff] font-medium">
                      {article.name}
                    </div>

                    <div className="col-span-3 text-right">
                      <button
                        type="button"
                        onClick={() => openAddArticlePopup(article)}
                        className="rounded-lg bg-[#0196ff] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Adaugă
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Articole selectate</h2>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu ai adăugat încă niciun articol în comandă.
              </p>
            ) : (
<div className="overflow-hidden rounded-xl border border-gray-200">
  <div className="grid grid-cols-12 border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-600">
    <div className="col-span-1">Nr.</div>
    <div className="col-span-2">Cod</div>
    <div className="col-span-4">Denumire</div>
    <div className="col-span-2">Qty</div>
    <div className="col-span-2 text-right">Val.(lei)</div>
    <div className="col-span-1 text-center"> </div>
  </div>

  {items.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const lineTotal = item.unit_price * qty;

    return (
      <div
        key={item.localId}
        className="grid grid-cols-12 items-center border-b px-3 py-2 text-[11px] last:border-b-0"
      >
        <div className="col-span-1 font-medium">
          {index + 1}
        </div>

        <div className="col-span-2 break-words">
          {item.article_code || "-"}
        </div>

        <div className="col-span-4 break-words font-medium text-[#0196ff] leading-4">
          {item.article_name}
        </div>

        <div className="col-span-2 flex justify-center">
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
className="w-10 h-7 rounded border border-gray-300 px-1 text-[11px] text-center"
          />
        </div>

        <div className="col-span-2 font-semibold text-right leading-4">
          {lineTotal.toFixed(2)}
        </div>

        <div className="col-span-1 text-center">
          <button
            type="button"
            onClick={() => removeItem(item.localId)}
            className="text-red-600 text-sm font-bold leading-none"
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
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Total comandă</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Subtotal articole</p>
                <p className="mt-1 text-xl font-bold">{subtotal.toFixed(2)} lei</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">TVA 21%</p>
                <p className="mt-1 text-xl font-bold">{vatTotal.toFixed(2)} lei</p>
              </div>

              <div className="rounded-xl bg-[#0196ff] p-4 text-white">
                <p className="text-sm opacity-90">Total cu TVA</p>
                <p className="mt-1 text-xl font-bold">
                  {totalWithVat.toFixed(2)} lei
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || sendingOrder}
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
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
              className="rounded-lg bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {sendingOrder ? "Se trimite..." : "Trimite comanda"}
            </button>
          </div>
        </div>

        {selectedArticleForPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold">Adaugă articol</h3>

<div className="mt-4 space-y-3">

  {/* Cod + UM */}
  <div className="flex justify-between items-center">
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

  {/* Denumire */}
  <div>
    <p className="text-xs text-gray-500">Denumire</p>
    <p className="text-sm font-semibold text-[#0196ff] break-words">
      {selectedArticleForPopup.name}
    </p>
  </div>

  {/* Pret + Cantitate pe acelasi rand */}
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  </div>

</div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeAddArticlePopup}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  Renunță
                </button>

                <button
                  type="button"
                  onClick={confirmAddArticle}
                  className="flex-1 rounded-lg bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white"
                >
                  Confirmă
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}