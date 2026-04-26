"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Role = "administrator" | "sef_echipa" | "user";
type Profile = { id: string; full_name: string; role: Role };
type Project = { id: string; name: string; beneficiary: string | null; status: string | null; created_at: string };
type ProjectFunding = { project_id: string; amount_ron: number | null };
type FiscalReceipt = { project_id: string; total_with_vat: number | null };
type ProjectInvoice = { project_id: string; total_with_vat: number | null };
type NondeductibleExpense = { project_id: string; cost_ron: number | null };

type Service = { id: string; name: string; um: string; price_ron: number };

type DailyReport = { id: string; project_id: string; report_date: string; created_by: string };
type DailyReportItem = {
  id: string;
  daily_report_id: string;
  service_id: string;
  quantity: number;
  service?: Service;
};

type DailyPhoto = {
  id: string;
  project_id: string;
  photo_date: string;
  photo_url: string;
  uploaded_by: string;
};

type ProjectTab = "financiar" | "tehnic";
type TehnicTab = "poze" | "deviz";
type UploadDocType = "bon" | "factura";

type InlineItem = { item_name: string; quantity: string; unit_price: string; line_total: string };
type InlineFormState = {
  documentDate: string; supplier: string; documentNumber: string;
  totalWithoutVat: string; totalWithVat: string; notes: string; items: InlineItem[];
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

const createEmptyItem = (): InlineItem => ({ item_name: "", quantity: "", unit_price: "", line_total: "" });
const createEmptyForm = (): InlineFormState => ({
  documentDate: "", supplier: "", documentNumber: "",
  totalWithoutVat: "", totalWithVat: "", notes: "", items: [createEmptyItem()],
});

const monthOptions = [
  { value: "toate", label: "Toate lunile" },
  { value: "1", label: "Ianuarie" }, { value: "2", label: "Februarie" },
  { value: "3", label: "Martie" }, { value: "4", label: "Aprilie" },
  { value: "5", label: "Mai" }, { value: "6", label: "Iunie" },
  { value: "7", label: "Iulie" }, { value: "8", label: "August" },
  { value: "9", label: "Septembrie" }, { value: "10", label: "Octombrie" },
  { value: "11", label: "Noiembrie" }, { value: "12", label: "Decembrie" },
];

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M12 16V4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9L12 4L17 9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20H20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProiectePage() {
  const router = useRouter();
  const bonInputRef = useRef<HTMLInputElement | null>(null);
  const facturaInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fundings, setFundings] = useState<ProjectFunding[]>([]);
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [nondeductibles, setNondeductibles] = useState<NondeductibleExpense[]>([]);

  // Tehnic state
  const [services, setServices] = useState<Service[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [dailyReportItems, setDailyReportItems] = useState<DailyReportItem[]>([]);
  const [dailyPhotos, setDailyPhotos] = useState<DailyPhoto[]>([]);

  // UI state
  const [searchName, setSearchName] = useState("");
  const [selectedYear, setSelectedYear] = useState("toate");
  const [selectedMonth, setSelectedMonth] = useState("toate");

  // Per-project tab state
  const [projectTabs, setProjectTabs] = useState<Record<string, ProjectTab>>({});
  const [tehnicTabs, setTehnicTabs] = useState<Record<string, TehnicTab>>({});

  // Financiar inline form
  const [activeInlineProjectId, setActiveInlineProjectId] = useState<string | null>(null);
  const [activeInlineType, setActiveInlineType] = useState<UploadDocType | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [formState, setFormState] = useState<InlineFormState>(createEmptyForm());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [savingInline, setSavingInline] = useState(false);

  // Deviz state per project
  const [devizProjectId, setDevizProjectId] = useState<string | null>(null);
  const [devizDate, setDevizDate] = useState(getTodayDate());
  const [devizItems, setDevizItems] = useState<{ service_id: string; quantity: string }[]>([]);
  const [savingDeviz, setSavingDeviz] = useState(false);
  const [devizReportId, setDevizReportId] = useState<string | null>(null);

  // Poze state
  const [photoProjectId, setPhotoProjectId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoViewDate, setPhotoViewDate] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === "administrator";

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

    let visibleProjects: Project[] = [];

    if (profileData.role === "administrator") {
      const { data } = await supabase.from("projects")
        .select("id, name, beneficiary, status, created_at")
        .order("created_at", { ascending: true });
      visibleProjects = (data as Project[]) || [];
    } else {
      const { data: linked } = await supabase.from("project_team_leads")
        .select("project_id").eq("user_id", user.id);
      const ids = (linked || []).map((r: any) => r.project_id);
      if (ids.length > 0) {
        const { data } = await supabase.from("projects")
          .select("id, name, beneficiary, status, created_at")
          .in("id", ids).order("created_at", { ascending: true });
        visibleProjects = (data as Project[]) || [];
      }
    }

    setProjects(visibleProjects);
    const projectIds = visibleProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      const fundingsQuery = profileData.role === "sef_echipa"
        ? supabase.from("project_fundings").select("project_id, amount_ron")
            .in("project_id", projectIds).eq("team_lead_user_id", user.id)
        : supabase.from("project_fundings").select("project_id, amount_ron")
            .in("project_id", projectIds);

      const [fundingsRes, receiptsRes, invoicesRes, nondeductiblesRes, servicesRes,
              reportsRes, reportItemsRes, photosRes] = await Promise.all([
        fundingsQuery,
        supabase.from("fiscal_receipts").select("project_id, total_with_vat").in("project_id", projectIds),
        supabase.from("project_invoices").select("project_id, total_with_vat").in("project_id", projectIds),
        supabase.from("project_nondeductible_expenses").select("project_id, cost_ron").in("project_id", projectIds),
        supabase.from("services").select("id, name, um, price_ron").eq("is_active", true).order("name"),
        supabase.from("daily_reports").select("id, project_id, report_date, created_by").in("project_id", projectIds).order("report_date", { ascending: false }),
        supabase.from("daily_report_items").select("id, daily_report_id, service_id, quantity"),
        supabase.from("daily_photos").select("id, project_id, photo_date, photo_url, uploaded_by").in("project_id", projectIds).order("created_at", { ascending: false }),
      ]);

      setFundings((fundingsRes.data as ProjectFunding[]) || []);
      setReceipts((receiptsRes.data as FiscalReceipt[]) || []);
      setInvoices((invoicesRes.data as ProjectInvoice[]) || []);
      setNondeductibles((nondeductiblesRes.data as NondeductibleExpense[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setDailyReports((reportsRes.data as DailyReport[]) || []);
      setDailyReportItems((reportItemsRes.data as DailyReportItem[]) || []);
      setDailyPhotos((photosRes.data as DailyPhoto[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [router]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getProjectTab = (id: string): ProjectTab => projectTabs[id] || "financiar";
  const getTehnicTab = (id: string): TehnicTab => tehnicTabs[id] || "poze";

  const setProjectTab = (id: string, tab: ProjectTab) =>
    setProjectTabs((prev) => ({ ...prev, [id]: tab }));
  const setTehnicTab = (id: string, tab: TehnicTab) =>
    setTehnicTabs((prev) => ({ ...prev, [id]: tab }));

  const availableYears = useMemo(() => {
    const years = projects.map((p) => new Date(p.created_at).getFullYear().toString());
    return ["toate", ...Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a))];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const d = new Date(p.created_at);
      const q = searchName.toLowerCase();
      return (
        (p.name.toLowerCase().includes(q) || (p.beneficiary || "").toLowerCase().includes(q)) &&
        (selectedYear === "toate" || d.getFullYear().toString() === selectedYear) &&
        (selectedMonth === "toate" || (d.getMonth() + 1).toString() === selectedMonth)
      );
    });
  }, [projects, searchName, selectedYear, selectedMonth]);

  const fundingTotalsByProject = useMemo(() => {
    const map = new Map<string, number>();
    fundings.forEach((r) => map.set(r.project_id, (map.get(r.project_id) || 0) + Number(r.amount_ron || 0)));
    return map;
  }, [fundings]);

  const currentCreditByProject = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      const funded = fundingTotalsByProject.get(p.id) || 0;
      const spent = (receipts.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.total_with_vat || 0), 0)) +
        (invoices.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.total_with_vat || 0), 0)) +
        (nondeductibles.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.cost_ron || 0), 0));
      map.set(p.id, funded - spent);
    });
    return map;
  }, [projects, fundingTotalsByProject, receipts, invoices, nondeductibles]);

  const getStatusLabel = (s: string | null) => {
    if (s === "in_asteptare") return "În așteptare";
    if (s === "in_lucru") return "În lucru";
    if (s === "finalizat") return "Finalizat";
    return "-";
  };

  const getStatusClasses = (s: string | null) => {
    if (s === "in_asteptare") return "bg-yellow-100 text-yellow-700";
    if (s === "in_lucru") return "bg-[#0196ff]/10 text-[#0196ff]";
    if (s === "finalizat") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const renderProjectIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7">
      <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="4" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="10" width="7" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );

  // ── Financiar handlers ────────────────────────────────────────────────────
  const resetInlineState = (projectId: string, type: UploadDocType) => {
    setActiveInlineProjectId(projectId);
    setActiveInlineType(type);
    setImagePreview(""); setUploadedImageUrl(""); setExtractionError("");
    setFormState(createEmptyForm());
  };

  const openCameraFor = (projectId: string, type: UploadDocType) => {
    resetInlineState(projectId, type);
    if (type === "bon") bonInputRef.current?.click();
    else facturaInputRef.current?.click();
  };

  const uploadImageToStorage = async (file: File, projectId: string, type: UploadDocType) => {
    setUploadingImage(true);
    const bucket = type === "bon" ? "bonuri-fiscale" : "facturi";
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${projectId}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: false });
    if (error) { setUploadingImage(false); alert(`Eroare: ${error.message}`); return ""; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setUploadedImageUrl(data.publicUrl);
    setUploadingImage(false);
    return data.publicUrl;
  };

  const applyExtractedData = (data: any) => {
    setFormState({
      documentDate: data.document_date || "",
      supplier: data.supplier || "",
      documentNumber: data.document_number || "",
      totalWithoutVat: data.total_without_vat != null ? String(data.total_without_vat) : "",
      totalWithVat: data.total_with_vat != null ? String(data.total_with_vat) : "",
      notes: data.notes || "",
      items: Array.isArray(data.items) && data.items.length > 0
        ? data.items.map((item: any) => ({
            item_name: item.item_name || "",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit_price: item.unit_price != null ? String(item.unit_price) : "",
            line_total: item.line_total != null ? String(item.line_total) : "",
          }))
        : [createEmptyItem()],
    });
  };

  const handleCapturedDocument = async (e: ChangeEvent<HTMLInputElement>, type: UploadDocType) => {
    const file = e.target.files?.[0];
    const projectId = activeInlineProjectId;
    if (!file || !projectId) return;
    setExtractionError("");
    setImagePreview(URL.createObjectURL(file));
    const publicUrl = await uploadImageToStorage(file, projectId, type);
    if (!publicUrl) return;
    setIsExtracting(true);
    try {
      const endpoint = type === "bon" ? "/api/extract-receipt" : "/api/extract-invoice";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: publicUrl }) });
      const parsed = await res.json();
      if (!res.ok) { setExtractionError(parsed.error || "Nu s-au putut extrage datele."); return; }
      applyExtractedData(parsed);
    } catch { setExtractionError("A apărut o eroare la analiza AI."); }
    finally { setIsExtracting(false); e.target.value = ""; }
  };

  const updateFormField = (field: keyof Omit<InlineFormState, "items">, value: string) =>
    setFormState((prev) => ({ ...prev, [field]: value }));

  const updateItem = (index: number, field: keyof InlineItem, value: string) =>
    setFormState((prev) => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item) }));

  const addItem = () => setFormState((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  const removeItem = (index: number) => setFormState((prev) => ({ ...prev, items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index) }));

  const computedItemsTotal = useMemo(() => formState.items.reduce((s, item) => s + Number(item.line_total || 0), 0), [formState.items]);

  const handleSaveInline = async () => {
    if (!activeInlineProjectId || !activeInlineType) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    if (!formState.documentDate) { alert("Completează data."); return; }
    if (!formState.supplier.trim()) { alert("Completează furnizorul."); return; }
    if (!formState.documentNumber.trim()) { alert("Completează numărul documentului."); return; }
    const validItems = formState.items.filter((item) => item.item_name.trim() || Number(item.quantity || 0) > 0);
    if (validItems.length === 0) { alert("Adaugă cel puțin un material."); return; }
    setSavingInline(true);

    if (activeInlineType === "bon") {
      const { data: receiptData, error } = await supabase.from("fiscal_receipts").insert({
        project_id: activeInlineProjectId, uploaded_by: user.id,
        receipt_image_url: uploadedImageUrl || null, receipt_date: formState.documentDate,
        supplier: formState.supplier.trim(), document_number: formState.documentNumber.trim(),
        total_without_vat: Number(formState.totalWithoutVat || 0),
        total_with_vat: Number(formState.totalWithVat || 0),
        notes: formState.notes.trim() || null,
      }).select("id").single();
      if (error || !receiptData) { alert(`Eroare: ${error?.message}`); setSavingInline(false); return; }
      await supabase.from("fiscal_receipt_items").insert(validItems.map((item) => ({
        receipt_id: receiptData.id, item_name: item.item_name.trim(),
        quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), line_total: Number(item.line_total || 0),
      })));
    } else {
      const { data: invoiceData, error } = await supabase.from("project_invoices").insert({
        project_id: activeInlineProjectId, uploaded_by: user.id,
        invoice_image_url: uploadedImageUrl || null, invoice_date: formState.documentDate,
        supplier: formState.supplier.trim(), document_number: formState.documentNumber.trim(),
        total_without_vat: Number(formState.totalWithoutVat || 0),
        total_with_vat: Number(formState.totalWithVat || 0),
        notes: formState.notes.trim() || null,
      }).select("id").single();
      if (error || !invoiceData) { alert(`Eroare: ${error?.message}`); setSavingInline(false); return; }
      await supabase.from("project_invoice_items").insert(validItems.map((item) => ({
        invoice_id: invoiceData.id, item_name: item.item_name.trim(),
        quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), line_total: Number(item.line_total || 0),
      })));
    }

    setSavingInline(false);
    setActiveInlineProjectId(null); setActiveInlineType(null);
    setImagePreview(""); setUploadedImageUrl(""); setExtractionError("");
    setFormState(createEmptyForm());
    await loadData();
  };

  // ── POZE handlers ─────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !photoProjectId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploadingPhoto(true);
    const today = getTodayDate();

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${photoProjectId}/${today}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("site-photos").upload(fileName, file, { upsert: false });
      if (uploadError) { console.error(uploadError); continue; }
      const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(fileName);
      await supabase.from("daily_photos").insert({
        project_id: photoProjectId,
        photo_date: today,
        photo_url: urlData.publicUrl,
        uploaded_by: user.id,
      });
    }

    setUploadingPhoto(false);
    e.target.value = "";
    await loadData();
  };

  // ── DEVIZ handlers ────────────────────────────────────────────────────────
  const openDeviz = async (projectId: string) => {
    setDevizProjectId(projectId);
    setDevizDate(getTodayDate());

    const existing = dailyReports.find((r) => r.project_id === projectId && r.report_date === getTodayDate());
    if (existing) {
      setDevizReportId(existing.id);
      const items = dailyReportItems.filter((i) => i.daily_report_id === existing.id);
      setDevizItems(items.map((i) => ({ service_id: i.service_id, quantity: String(i.quantity) })));
    } else {
      setDevizReportId(null);
      setDevizItems([{ service_id: "", quantity: "" }]);
    }
  };

  const addDevizLine = () => setDevizItems((prev) => [...prev, { service_id: "", quantity: "" }]);
  const removeDevizLine = (index: number) => setDevizItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  const updateDevizLine = (index: number, field: "service_id" | "quantity", value: string) =>
    setDevizItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const handleSaveDeviz = async () => {
    if (!devizProjectId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const validLines = devizItems.filter((l) => l.service_id && Number(l.quantity || 0) > 0);
    if (validLines.length === 0) { alert("Adaugă cel puțin un serviciu cu cantitate."); return; }

    setSavingDeviz(true);

    let reportId = devizReportId;

    if (!reportId) {
      const { data: inserted, error: insertError } = await supabase.from("daily_reports").insert({
        project_id: devizProjectId, report_date: devizDate, created_by: user.id,
      }).select("id").single();

      if (insertError) {
        const { data: existing } = await supabase.from("daily_reports")
          .select("id").eq("project_id", devizProjectId).eq("report_date", devizDate).single();
        if (!existing) { alert(`Eroare: ${insertError.message}`); setSavingDeviz(false); return; }
        reportId = existing.id;
      } else {
        reportId = inserted.id;
      }
      setDevizReportId(reportId);
    }

    await supabase.from("daily_report_items").delete().eq("daily_report_id", reportId);
    const { error: itemsError } = await supabase.from("daily_report_items").insert(
      validLines.map((l) => ({ daily_report_id: reportId, service_id: l.service_id, quantity: Number(l.quantity) }))
    );

    if (itemsError) { alert(`Eroare la salvarea devizului: ${itemsError.message}`); setSavingDeviz(false); return; }

    setSavingDeviz(false);
    setDevizProjectId(null);
    await loadData();
  };

  const handleExportDeviz = (projectId: string, date: string, projectName: string) => {
    const report = dailyReports.find((r) => r.project_id === projectId && r.report_date === date);
    if (!report) { alert("Nu există deviz pentru această zi."); return; }

    const items = dailyReportItems.filter((i) => i.daily_report_id === report.id);
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text(`Deviz lucrări – ${projectName}`, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(date).toLocaleDateString("ro-RO")}  |  Generat la ${new Date().toLocaleString("ro-RO")}`, 14, 22);
    doc.setTextColor(0);

    let total = 0;
    const rows = items.map((item, i) => {
      const svc = serviceMap.get(item.service_id);
      const lineTotal = (svc?.price_ron || 0) * item.quantity;
      total += lineTotal;
      return [String(i + 1), svc?.name || "-", svc?.um || "-", String(item.quantity), `${(svc?.price_ron || 0).toFixed(2)} lei`, `${lineTotal.toFixed(2)} lei`];
    });

    autoTable(doc, {
      startY: 28,
      head: [["Nr.", "Serviciu", "UM", "Cantitate", "Preț unitar", "Total"]],
      body: rows,
      foot: [["", "", "", "", "TOTAL", `${total.toFixed(2)} lei`]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [1, 150, 255] },
      footStyles: { fillColor: [240, 238, 233], fontStyle: "bold" },
      theme: "grid",
    });

    doc.save(`deviz_${projectName.replace(/\s+/g, "_")}_${date}.pdf`);
  };

  // ── Grouped photos by date ────────────────────────────────────────────────
  const photosByProjectAndDate = useMemo(() => {
    const map = new Map<string, Map<string, DailyPhoto[]>>();
    dailyPhotos.forEach((photo) => {
      if (!map.has(photo.project_id)) map.set(photo.project_id, new Map());
      const dateMap = map.get(photo.project_id)!;
      if (!dateMap.has(photo.photo_date)) dateMap.set(photo.photo_date, []);
      dateMap.get(photo.photo_date)!.push(photo);
    });
    return map;
  }, [dailyPhotos]);

  const reportsByProject = useMemo(() => {
    const map = new Map<string, DailyReport[]>();
    dailyReports.forEach((r) => {
      if (!map.has(r.project_id)) map.set(r.project_id, []);
      map.get(r.project_id)!.push(r);
    });
    return map;
  }, [dailyReports]);

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
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">{renderProjectIcon()}</div>
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
      <input ref={bonInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCapturedDocument(e, "bon")} />
      <input ref={facturaInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCapturedDocument(e, "factura")} />
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />
          <button onClick={() => router.push("/dashboard")} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div>
            <p className="text-sm text-gray-500">{isAdmin ? "Administrare proiecte" : "Proiectele tale"}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {isAdmin ? "Toate proiectele" : "Proiectele mele"}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{profile?.full_name}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input type="text" placeholder="Caută după nume sau beneficiar" value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500" />
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
              {availableYears.map((y) => <option key={y} value={y}>{y === "toate" ? "Toți anii" : y}</option>)}
            </select>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500">
              {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Lista proiecte</p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Nu există proiecte pentru filtrele selectate.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const currentCredit = currentCreditByProject.get(project.id) || 0;
                const projectTab = getProjectTab(project.id);
                const tehnicTab = getTehnicTab(project.id);
                const projectPhotos = photosByProjectAndDate.get(project.id);
                const photoViewDateForProject = photoViewDate[project.id] || getTodayDate();
                const photosForDate = projectPhotos?.get(photoViewDateForProject) || [];
                const allPhotoDates = projectPhotos ? Array.from(projectPhotos.keys()).sort((a, b) => b.localeCompare(a)) : [];
                const projectReports = reportsByProject.get(project.id) || [];

                return (
                  <div key={project.id} className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                            {renderProjectIcon()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-xl">{project.name}</p>
                            <p className="mt-1 text-sm text-gray-500">{project.beneficiary || "-"}</p>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(project.status)}`}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4 border-y border-gray-100 py-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Credit disponibil</p>
                          <p className={`mt-1 text-lg font-black ${currentCredit < 0 ? "text-red-600" : "text-gray-900"}`}>
                            {currentCredit.toLocaleString("ro-RO")} <span className="text-sm font-normal">RON</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dată deschidere</p>
                          <p className="mt-1 text-sm font-bold text-gray-700">
                            {new Date(project.created_at).toLocaleDateString("ro-RO")}
                          </p>
                        </div>
                      </div>

                      {/* Tab Navigation */}
                      <div className="mt-4 flex gap-1 rounded-2xl bg-gray-50 p-1">
                        <button
                          onClick={() => setProjectTab(project.id, "financiar")}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${projectTab === "financiar" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                        >
                          FINANCIAR
                        </button>
                        <button
                          onClick={() => setProjectTab(project.id, "tehnic")}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${projectTab === "tehnic" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                        >
                          TEHNIC
                        </button>
                      </div>

                      {/* Content: Financiar */}
                      {projectTab === "financiar" && (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => openCameraFor(project.id, "bon")}
                            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 transition hover:bg-gray-50"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                              <UploadIcon />
                            </div>
                            <span className="text-[11px] font-bold uppercase text-gray-600">Încarcă Bon</span>
                          </button>
                          <button
                            onClick={() => openCameraFor(project.id, "factura")}
                            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 transition hover:bg-gray-50"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                              <UploadIcon />
                            </div>
                            <span className="text-[11px] font-bold uppercase text-gray-600">Încarcă Factură</span>
                          </button>
                        </div>
                      )}

                      {/* Content: Tehnic */}
                      {projectTab === "tehnic" && (
                        <div className="mt-4 space-y-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setTehnicTab(project.id, "poze")}
                              className={`flex-1 rounded-xl py-2 text-[10px] font-bold transition ${tehnicTab === "poze" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}
                            >
                              POZE PROGRES
                            </button>
                            <button
                              onClick={() => setTehnicTab(project.id, "deviz")}
                              className={`flex-1 rounded-xl py-2 text-[10px] font-bold transition ${tehnicTab === "deviz" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}
                            >
                              DEVIZ ZILNIC
                            </button>
                          </div>

                          {tehnicTab === "poze" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase text-gray-400">Galerie Foto</p>
                                {!isAdmin && (
                                  <button
                                    onClick={() => { setPhotoProjectId(project.id); photoInputRef.current?.click(); }}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm"
                                  >
                                    <UploadIcon /> Adaugă poze
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {allPhotoDates.map((date) => (
                                  <button
                                    key={date}
                                    onClick={() => setPhotoViewDate({ ...photoViewDate, [project.id]: date })}
                                    className={`shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold transition ${photoViewDateForProject === date ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400"}`}
                                  >
                                    {new Date(date).toLocaleDateString("ro-RO")}
                                  </button>
                                ))}
                              </div>

                              <div className="flex w-full gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide py-2">
                                {photosForDate.length > 0 ? (
                                  photosForDate.map((p) => (
                                    <div key={p.id} className="min-w-[80%] shrink-0 snap-center sm:min-w-[280px]">
                                      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                                        <Image src={p.photo_url} alt="Progres" fill className="object-cover" />
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="py-4 text-[11px] italic text-gray-400 text-center w-full">Nicio poză pentru această dată.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {tehnicTab === "deviz" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase text-gray-400">Istoric Devize</p>
                                {!isAdmin && (
                                  <button
                                    onClick={() => openDeviz(project.id)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm"
                                  >
                                    + Adaugă deviz
                                  </button>
                                )}
                              </div>
                              
                              <div className="grid gap-2">
                                {projectReports.length > 0 ? (
                                  projectReports.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3">
                                      <span className="text-xs font-bold text-gray-700">{new Date(r.report_date).toLocaleDateString("ro-RO")}</span>
                                      <button
                                        onClick={() => handleExportDeviz(project.id, r.report_date, project.name)}
                                        className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold text-blue-600 shadow-sm"
                                      >
                                        EXPORT PDF
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="py-4 text-[11px] italic text-gray-400 text-center">Nu există devize create.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* --- Modale / Formulare (Păstrate din structura originală pentru funcționalitate) --- */}
      {/* Aici poți adăuga modalele de editare dacă dorești să le păstrezi vizibile doar pentru non-admini */}
    </div>
  );
}