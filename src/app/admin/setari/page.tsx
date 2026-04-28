"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
  is_active: boolean;
  created_at: string;
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

type Worker = {
  id: string;
  full_name: string;
  worker_type: string | null;
  is_active: boolean;
};

type WorkerLeave = {
  id: string;
  worker_id: string;
  year: number;
  days_total: number;
  days_taken: number;
};

type Tab = "servicii" | "articole" | "concediu";
type Toast = { type: "success" | "error"; message: string } | null;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SetariPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("servicii");
  const [toast, setToast] = useState<Toast>(null);

  // Servicii
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcUm, setSvcUm] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcActive, setSvcActive] = useState(true);

  // Articole
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [deletingArticle, setDeletingArticle] = useState<string | null>(null);
  const [artNumber, setArtNumber] = useState("");
  const [artCode, setArtCode] = useState("");
  const [artName, setArtName] = useState("");
  const [artUnit, setArtUnit] = useState("");
  const [artPrice, setArtPrice] = useState("");
  const [artVat, setArtVat] = useState("21");

  // Concediu
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerLeave, setWorkerLeave] = useState<WorkerLeave[]>([]);
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [leaveSearch, setLeaveSearch] = useState("");
  const [savingLeave, setSavingLeave] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<Record<string, { days_total: string; days_taken: string }>>({});

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadServices = async () => {
    const { data } = await supabase.from("services")
      .select("id, name, um, price_ron, is_active, created_at")
      .order("name", { ascending: true });
    setServices((data as Service[]) || []);
  };

  const loadArticles = async () => {
    const { data } = await supabase.from("inventory_articles")
      .select("id, article_number, article_code, name, unit, unit_price, vat_percent")
      .order("name", { ascending: true });
    setArticles((data as Article[]) || []);
  };

  const loadWorkersAndLeave = async () => {
    const [workersRes, leaveRes] = await Promise.all([
      supabase.from("workers").select("id, full_name, worker_type, is_active")
        .eq("is_active", true).order("full_name", { ascending: true }),
      supabase.from("worker_leave").select("id, worker_id, year, days_total, days_taken")
        .eq("year", leaveYear),
    ]);
    const w = (workersRes.data as Worker[]) || [];
    const l = (leaveRes.data as WorkerLeave[]) || [];
    setWorkers(w);
    setWorkerLeave(l);

    // Init editing state cu valorile existente sau default
    const init: Record<string, { days_total: string; days_taken: string }> = {};
    w.forEach((worker) => {
      const existing = l.find((x) => x.worker_id === worker.id);
      init[worker.id] = {
        days_total: String(existing?.days_total ?? 21),
        days_taken: String(existing?.days_taken ?? 0),
      };
    });
    setEditingLeave(init);
  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "administrator") { router.push("/dashboard"); return; }
      await Promise.all([loadServices(), loadArticles(), loadWorkersAndLeave()]);
      setLoading(false);
    };
    checkAndLoad();
  }, [router]);

  useEffect(() => {
    if (!loading) loadWorkersAndLeave();
  }, [leaveYear]);

  // ─── Servicii ─────────────────────────────────────────────────────────────

  const resetServiceForm = () => {
    setSvcName(""); setSvcUm(""); setSvcPrice(""); setSvcActive(true);
    setEditingServiceId(null); setShowServiceForm(false);
  };

  const openEditService = (svc: Service) => {
    setEditingServiceId(svc.id);
    setSvcName(svc.name); setSvcUm(svc.um);
    setSvcPrice(String(svc.price_ron)); setSvcActive(svc.is_active);
    setShowServiceForm(true);
  };

  const handleSaveService = async () => {
    if (!svcName.trim()) { showToast("error", "Completează denumirea serviciului."); return; }
    if (!svcUm.trim()) { showToast("error", "Completează unitatea de măsură."); return; }
    if (!svcPrice || Number(svcPrice) < 0) { showToast("error", "Completează un preț valid."); return; }

    setSavingService(true);
    if (editingServiceId) {
      const { error } = await supabase.from("services").update({
        name: svcName.trim(), um: svcUm.trim(),
        price_ron: Number(svcPrice), is_active: svcActive,
      }).eq("id", editingServiceId);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingService(false); return; }
    } else {
      const { error } = await supabase.from("services").insert({
        name: svcName.trim(), um: svcUm.trim(),
        price_ron: Number(svcPrice), is_active: svcActive,
      });
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingService(false); return; }
    }
    setSavingService(false);
    resetServiceForm();
    await loadServices();
    showToast("success", editingServiceId ? "Serviciu actualizat." : "Serviciu adăugat.");
  };

  const handleToggleServiceActive = async (svc: Service) => {
    await supabase.from("services").update({ is_active: !svc.is_active }).eq("id", svc.id);
    await loadServices();
  };

  const handleDeleteService = async (id: string) => {
    setDeletingService(id);
    await supabase.from("services").delete().eq("id", id);
    setDeletingService(null);
    await loadServices();
    showToast("success", "Serviciu șters.");
  };

  const filteredServices = services.filter((s) =>
    !serviceSearch.trim() ||
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.um.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  // ─── Articole ─────────────────────────────────────────────────────────────

  const resetArticleForm = () => {
    setArtNumber(""); setArtCode(""); setArtName("");
    setArtUnit(""); setArtPrice(""); setArtVat("21");
    setEditingArticleId(null); setShowArticleForm(false);
  };

  const openEditArticle = (art: Article) => {
    setEditingArticleId(art.id);
    setArtNumber(art.article_number || "");
    setArtCode(art.article_code || "");
    setArtName(art.name);
    setArtUnit(art.unit || "");
    setArtPrice(String(art.unit_price));
    setArtVat(String(art.vat_percent));
    setShowArticleForm(true);
  };

  const handleSaveArticle = async () => {
    if (!artName.trim()) { showToast("error", "Completează denumirea articolului."); return; }
    if (!artUnit.trim()) { showToast("error", "Completează unitatea de măsură."); return; }
    if (!artPrice || Number(artPrice) < 0) { showToast("error", "Completează un preț valid."); return; }

    setSavingArticle(true);
    const payload = {
      article_number: artNumber.trim() || null,
      article_code: artCode.trim() || null,
      name: artName.trim(),
      unit: artUnit.trim(),
      unit_price: Number(artPrice),
      vat_percent: Number(artVat) || 21,
    };

    if (editingArticleId) {
      const { error } = await supabase.from("inventory_articles").update(payload).eq("id", editingArticleId);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingArticle(false); return; }
    } else {
      const { error } = await supabase.from("inventory_articles").insert(payload);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingArticle(false); return; }
    }
    setSavingArticle(false);
    resetArticleForm();
    await loadArticles();
    showToast("success", editingArticleId ? "Articol actualizat." : "Articol adăugat.");
  };

  const handleDeleteArticle = async (id: string) => {
    setDeletingArticle(id);
    await supabase.from("inventory_articles").delete().eq("id", id);
    setDeletingArticle(null);
    await loadArticles();
    showToast("success", "Articol șters.");
  };

  const filteredArticles = articles.filter((a) =>
    !articleSearch.trim() ||
    a.name.toLowerCase().includes(articleSearch.toLowerCase()) ||
    (a.article_code || "").toLowerCase().includes(articleSearch.toLowerCase()) ||
    (a.article_number || "").toLowerCase().includes(articleSearch.toLowerCase())
  );

  // ─── Concediu ─────────────────────────────────────────────────────────────

  const handleSaveLeave = async (workerId: string) => {
    const val = editingLeave[workerId];
    if (!val) return;

    const daysTotal = Number(val.days_total) || 0;
    const daysTaken = Number(val.days_taken) || 0;

    setSavingLeave(workerId);

    const existing = workerLeave.find((l) => l.worker_id === workerId && l.year === leaveYear);

    if (existing) {
      const { error } = await supabase.from("worker_leave").update({
        days_total: daysTotal, days_taken: daysTaken,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingLeave(null); return; }
    } else {
      const { error } = await supabase.from("worker_leave").insert({
        worker_id: workerId, year: leaveYear,
        days_total: daysTotal, days_taken: daysTaken,
      });
      if (error) { showToast("error", `Eroare: ${error.message}`); setSavingLeave(null); return; }
    }

    setSavingLeave(null);
    await loadWorkersAndLeave();
    showToast("success", "Concediu actualizat.");
  };

  const filteredWorkers = workers.filter((w) =>
    !leaveSearch.trim() || w.full_name.toLowerCase().includes(leaveSearch.toLowerCase())
  );

  const getWorkerTypeBadge = (type: string | null) => {
    if (type === "personal_executie") return { label: "Execuție", classes: "bg-blue-100 text-blue-700" };
    if (type === "tesa") return { label: "TESA", classes: "bg-purple-100 text-purple-700" };
    return { label: type || "-", classes: "bg-gray-100 text-gray-600" };
  };

  // ─── Icons ────────────────────────────────────────────────────────────────

  const renderSettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-gray-600 sm:h-7 sm:w-7">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 12a1.8 1.8 0 0 0 1.3 1.7l.1.1a1.9 1.9 0 0 1-1.3 3.3h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.8 1.8 0 0 0-1.6 1l-.1.2a1.9 1.9 0 0 1-3.4 0l-.1-.2a1.8 1.8 0 0 0-1.6-1h-.2a1.9 1.9 0 0 1-1.3-3.3l.1-.1A1.8 1.8 0 0 0 5 12c0-.7-.3-1.3-.8-1.7l-.1-.1a1.9 1.9 0 0 1 1.3-3.3h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.8 1.8 0 0 0 1.6-1l.1-.2a1.9 1.9 0 0 1 3.4 0l.1.2a1.8 1.8 0 0 0 1.6 1h.2a1.9 1.9 0 0 1 1.3 3.3l-.1.1c-.5.4-.8 1-.8 1.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-100">{renderSettingsIcon()}</div>
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
          <button onClick={() => router.push("/admin")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-gray-100 sm:h-14 sm:w-14">
              {renderSettingsIcon()}
            </div>
            <div>
              <p className="text-sm text-gray-500">Administrare</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Alte setări</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                Gestionează serviciile deviz, articolele pentru comenzi și zilele de concediu ale angajaților.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {([
              { key: "servicii", label: "Servicii deviz", count: services.filter(s => s.is_active).length },
              { key: "articole", label: "Articole comenzi", count: articles.length },
              { key: "concediu", label: "Zile concediu", count: workers.length },
            ] as { key: Tab; label: string; count: number }[]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-[#0196ff] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── TAB SERVICII ───────────────────────────────────────────────────── */}
        {activeTab === "servicii" && (
          <section className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Servicii deviz</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Serviciile vizibile în devizul zilnic al șefilor de echipă.
                </p>
              </div>
              <button onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
                className="shrink-0 rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                + Serviciu nou
              </button>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white px-4 py-3 shadow-sm">
              <input type="text" placeholder="Caută după denumire sau UM..."
                value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
            </div>

            {/* Form serviciu */}
            {showServiceForm && (
              <div className="rounded-[22px] border border-[#0196ff]/30 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                    {editingServiceId ? "Editează serviciu" : "Serviciu nou"}
                  </p>
                  <div className="h-px flex-1 bg-[#E8E5DE]" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Denumire <span className="text-red-500">*</span></label>
                    <input type="text" value={svcName} onChange={(e) => setSvcName(e.target.value)}
                      placeholder="Ex: Tencuială interioară"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">UM <span className="text-red-500">*</span></label>
                    <input type="text" value={svcUm} onChange={(e) => setSvcUm(e.target.value)}
                      placeholder="Ex: mp, ml, buc"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Preț (lei/UM) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type="number" min="0" step="0.01" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)}
                        placeholder="Ex: 45.00"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm outline-none focus:border-gray-500" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">lei</span>
                    </div>
                  </div>
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 hover:bg-gray-50">
                  <input type="checkbox" checked={svcActive} onChange={(e) => setSvcActive(e.target.checked)} className="h-5 w-5" />
                  <span className="text-sm font-medium text-gray-800">Serviciu activ (vizibil în deviz)</span>
                </label>
                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={handleSaveService} disabled={savingService}
                    className="rounded-xl bg-[#0196ff] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                    {savingService ? "Se salvează..." : editingServiceId ? "Salvează modificările" : "Adaugă serviciu"}
                  </button>
                  <button type="button" onClick={resetServiceForm}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                    Anulează
                  </button>
                </div>
              </div>
            )}

            {/* Lista servicii */}
            {filteredServices.length === 0 ? (
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  {serviceSearch ? "Nu există servicii pentru căutarea introdusă." : "Nu există servicii adăugate."}
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
                        <button type="button" onClick={() => handleToggleServiceActive(svc)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${svc.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {svc.is_active ? "Activ" : "Inactiv"}
                        </button>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <button type="button" onClick={() => openEditService(svc)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                        <button type="button" onClick={() => handleDeleteService(svc.id)} disabled={deletingService === svc.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                          {deletingService === svc.id ? "..." : "Șterge"}
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
                        <button type="button" onClick={() => handleToggleServiceActive(svc)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${svc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {svc.is_active ? "Activ" : "Inactiv"}
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => openEditService(svc)}
                          className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                        <button type="button" onClick={() => handleDeleteService(svc.id)} disabled={deletingService === svc.id}
                          className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                          {deletingService === svc.id ? "..." : "Șterge"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── TAB ARTICOLE ───────────────────────────────────────────────────── */}
        {activeTab === "articole" && (
          <section className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Articole comenzi</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Articolele disponibile la crearea comenzilor de materiale.
                </p>
              </div>
              <button onClick={() => { resetArticleForm(); setShowArticleForm(true); }}
                className="shrink-0 rounded-xl bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                + Articol nou
              </button>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white px-4 py-3 shadow-sm">
              <input type="text" placeholder="Caută după denumire, cod sau număr articol..."
                value={articleSearch} onChange={(e) => setArticleSearch(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
            </div>

            {/* Form articol */}
            {showArticleForm && (
              <div className="rounded-[22px] border border-[#0196ff]/30 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                    {editingArticleId ? "Editează articol" : "Articol nou"}
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
                  <button type="button" onClick={handleSaveArticle} disabled={savingArticle}
                    className="rounded-xl bg-[#0196ff] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                    {savingArticle ? "Se salvează..." : editingArticleId ? "Salvează modificările" : "Adaugă articol"}
                  </button>
                  <button type="button" onClick={resetArticleForm}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                    Anulează
                  </button>
                </div>
              </div>
            )}

            {/* Lista articole */}
            {filteredArticles.length === 0 ? (
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  {articleSearch ? "Nu există articole pentru căutarea introdusă." : "Nu există articole adăugate."}
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
                        <button type="button" onClick={() => openEditArticle(art)}
                          className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          Editează
                        </button>
                        <button type="button" onClick={() => handleDeleteArticle(art.id)} disabled={deletingArticle === art.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                          {deletingArticle === art.id ? "..." : "Șterge"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 lg:hidden">
                  {filteredArticles.map((art) => (
                    <div key={art.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-bold text-gray-900">{art.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {art.article_code || "-"} · {art.unit || "-"} · {Number(art.unit_price).toFixed(2)} lei · TVA {art.vat_percent}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => openEditArticle(art)}
                          className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Editează</button>
                        <button type="button" onClick={() => handleDeleteArticle(art.id)} disabled={deletingArticle === art.id}
                          className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60">
                          {deletingArticle === art.id ? "..." : "Șterge"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── TAB CONCEDIU ───────────────────────────────────────────────────── */}
        {activeTab === "concediu" && (
          <section className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-extrabold text-gray-900">Zile de concediu</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Setează zilele anuale și zilele luate pentru fiecare angajat activ.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-[#F8F7F3] px-4 py-2.5">
                  <label className="text-sm font-semibold text-gray-600">An:</label>
                  <select value={leaveYear} onChange={(e) => setLeaveYear(Number(e.target.value))}
                    className="bg-transparent text-sm font-bold text-gray-900 outline-none">
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <input type="text" placeholder="Caută angajat..."
                  value={leaveSearch} onChange={(e) => setLeaveSearch(e.target.value)}
                  className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
              </div>
            </div>

            {filteredWorkers.length === 0 ? (
              <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Nu există angajați activi.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWorkers.map((worker) => {
                  const val = editingLeave[worker.id] || { days_total: "21", days_taken: "0" };
                  const daysTotal = Number(val.days_total) || 0;
                  const daysTaken = Number(val.days_taken) || 0;
                  const daysRemaining = daysTotal - daysTaken;
                  const badge = getWorkerTypeBadge(worker.worker_type);

                  return (
                    <div key={worker.id} className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900">{worker.full_name}</p>
                          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className={`shrink-0 rounded-2xl px-3 py-2 text-center ${daysRemaining < 0 ? "bg-red-50" : daysRemaining === 0 ? "bg-gray-100" : "bg-green-50"}`}>
                          <p className={`text-xl font-extrabold ${daysRemaining < 0 ? "text-red-600" : daysRemaining === 0 ? "text-gray-500" : "text-green-700"}`}>
                            {daysRemaining}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-400">zile rămase</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Zile anuale totale</label>
                          <input
                            type="number" min="0" step="1"
                            value={val.days_total}
                            onChange={(e) => setEditingLeave((prev) => ({
                              ...prev, [worker.id]: { ...prev[worker.id], days_total: e.target.value }
                            }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#0196ff]"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Zile luate</label>
                          <input
                            type="number" min="0" step="1"
                            value={val.days_taken}
                            onChange={(e) => setEditingLeave((prev) => ({
                              ...prev, [worker.id]: { ...prev[worker.id], days_taken: e.target.value }
                            }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#0196ff]"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveLeave(worker.id)}
                        disabled={savingLeave === worker.id}
                        className="mt-3 w-full rounded-xl bg-[#0196ff] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {savingLeave === worker.id ? "Se salvează..." : "Salvează"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
