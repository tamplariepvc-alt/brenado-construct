"use client";

import { useEffect, useMemo, useState } from "react";
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
  quantity: number;
};

function generateLocalId() {
  return Math.random().toString(36).slice(2);
}

export default function EditareComandaPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const [orderDate, setOrderDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([]);

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
        .select("id, project_id, created_by, order_date, status, subtotal, vat_total, total_with_vat, notes")
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

      const { data: articlesData } = await supabase
        .from("inventory_articles")
        .select("id, article_number, article_code, name, unit, unit_price, vat_percent")
        .order("name", { ascending: true });

      if (articlesData) {
        setArticles(articlesData as Article[]);
      }

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("id, article_id, article_number, article_code, article_name, unit, unit_price, vat_percent, quantity")
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
            vat_percent: Number(item.vat_percent || 19),
            quantity: Number(item.quantity || 1),
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

  const addArticleToOrder = (article: Article) => {
    setItems((prev) => [
      ...prev,
      {
        localId: generateLocalId(),
        article_id: article.id,
        article_number: article.article_number || "",
        article_code: article.article_code || "",
        article_name: article.name,
        unit: article.unit || "",
        unit_price: Number(article.unit_price || 0),
        vat_percent: Number(article.vat_percent || 19),
        quantity: 1,
      },
    ]);
  };

  const updateItemQuantity = (localId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? { ...item, quantity: quantity > 0 ? quantity : 1 }
          : item
      )
    );
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [items]);

  const vatTotal = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity * (item.vat_percent / 100),
      0
    );
  }, [items]);

  const totalWithVat = useMemo(() => subtotal + vatTotal, [subtotal, vatTotal]);

  const saveOrder = async (status: "draft" | "asteapta_confirmare") => {
    if (!selectedProjectId) {
      alert("Selectează un șantier.");
      return;
    }

    if (items.length === 0) {
      alert("Adaugă cel puțin un articol în comandă.");
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
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) {
      alert("Comanda a fost actualizată, dar liniile vechi nu au putut fi șterse.");
      return;
    }

    const orderItemsRows = items.map((item) => {
      const lineTotal = item.unit_price * item.quantity;
      const lineTotalWithVat = lineTotal + lineTotal * (item.vat_percent / 100);

      return {
        order_id: orderId,
        article_id: item.article_id,
        article_number: item.article_number,
        article_code: item.article_code,
        article_name: item.article_name,
        unit: item.unit,
        unit_price: Number(item.unit_price.toFixed(2)),
        quantity: Number(item.quantity.toFixed(2)),
        line_total: Number(lineTotal.toFixed(2)),
        vat_percent: Number(item.vat_percent.toFixed(2)),
        line_total_with_vat: Number(lineTotalWithVat.toFixed(2)),
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsError) {
      alert("Comanda a fost actualizată, dar articolele nu au putut fi salvate.");
      return;
    }

    alert(
      status === "draft"
        ? "Draftul a fost actualizat."
        : "Comanda a fost trimisă cu succes."
    );

    router.push("/comenzi");
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    await saveOrder("draft");
    setSavingDraft(false);
  };

  const handleSendOrder = async () => {
    setSendingOrder(true);
    await saveOrder("asteapta_confirmare");
    setSendingOrder(false);
  };

  if (loading) {
    return <div className="p-6">Se încarcă draftul...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Editează comandă draft</h1>
            <p className="text-sm text-gray-600">
              Modifică articolele și trimite comanda când este gata.
            </p>
          </div>

          <button
            onClick={() => router.push(`/comenzi/${orderId}`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la detaliu comandă
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
            </div>

            <div className="max-h-80 overflow-auto rounded-xl border border-gray-200">
              <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                <div className="col-span-2">Nr.</div>
                <div className="col-span-2">Cod</div>
                <div className="col-span-4">Denumire</div>
                <div className="col-span-2">Preț unitar</div>
                <div className="col-span-2 text-right">Acțiune</div>
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
                    <div className="col-span-2">{article.article_number || "-"}</div>
                    <div className="col-span-2">{article.article_code || "-"}</div>
                    <div className="col-span-4">{article.name}</div>
                    <div className="col-span-2">
                      {Number(article.unit_price).toFixed(2)} lei
                    </div>
                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => addArticleToOrder(article)}
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
              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineTotal = item.unit_price * item.quantity;
                  const lineTotalWithVat =
                    lineTotal + lineTotal * (item.vat_percent / 100);

                  return (
                    <div
                      key={item.localId}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {index + 1}. {item.article_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Nr.: {item.article_number || "-"} | Cod: {item.article_code || "-"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.localId)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          Șterge
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-600">
                            Preț unitar
                          </label>
                          <input
                            type="number"
                            value={item.unit_price}
                            disabled
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-600">
                            Cantitate
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(item.localId, Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-600">
                            U.M.
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            disabled
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-600">
                            Valoare
                          </label>
                          <input
                            type="text"
                            value={`${lineTotal.toFixed(2)} lei`}
                            disabled
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-600">
                            Valoare cu TVA
                          </label>
                          <input
                            type="text"
                            value={`${lineTotalWithVat.toFixed(2)} lei`}
                            disabled
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm"
                          />
                        </div>
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
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="mt-1 text-xl font-bold">{subtotal.toFixed(2)} lei</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">TVA</p>
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
      </div>
    </div>
  );
}