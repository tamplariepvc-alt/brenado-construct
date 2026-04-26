"use client";

import Image from "next/image";
import {
  ChangeEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Role = "administrator" | "sef_echipa" | "user";
type Profile = { id: string; full_name: string; role: Role };

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  status: string | null;
  created_at: string;
};

type ProjectFunding = { project_id: string; amount_ron: number | null };
type FiscalReceipt = { project_id: string; total_with_vat: number | null };
type ProjectInvoice = { project_id: string; total_with_vat: number | null };
type NondeductibleExpense = { project_id: string; cost_ron: number | null };

type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
};

type DailyReport = {
  id: string;
  project_id: string;
  report_date: string;
  created_by: string;
};

type DailyReportItem = {
  id: string;
  daily_report_id: string;
  service_id: string;
  quantity: number;
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

type InlineItem = {
  item_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

type InlineFormState = {
  documentDate: string;
  supplier: string;
  documentNumber: string;
  totalWithoutVat: string;
  totalWithVat: string;
  notes: string;
  items: InlineItem[];
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

const createEmptyItem = (): InlineItem => ({
  item_name: "",
  quantity: "",
  unit_price: "",
  line_total: "",
});

const createEmptyForm = (): InlineFormState => ({
  documentDate: "",
  supplier: "",
  documentNumber: "",
  totalWithoutVat: "",
  totalWithVat: "",
  notes: "",
  items: [createEmptyItem()],
});

const monthOptions = [
  { value: "toate", label: "Toate lunile" },
  { value: "1", label: "Ianuarie" },
  { value: "2", label: "Februarie" },
  { value: "3", label: "Martie" },
  { value: "4", label: "Aprilie" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Iunie" },
  { value: "7", label: "Iulie" },
  { value: "8", label: "August" },
  { value: "9", label: "Septembrie" },
  { value: "10", label: "Octombrie" },
  { value: "11", label: "Noiembrie" },
  { value: "12", label: "Decembrie" },
];

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M12 16V4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9L12 4L17 9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20H20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: DailyPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const prev = useCallback(() => {
    setCurrent((c) => (c > 0 ? c - 1 : photos.length - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c < photos.length - 1 ? c + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

    if (Math.abs(dx) > 40 && dy < 60) {
      dx < 0 ? next() : prev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClose}
    >
      <img
        src={photos[current].photo_url}
        alt="Poză șantier"
        className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm font-semibold text-white">
        {current + 1} / {photos.length}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-xl text-white transition hover:bg-black/70"
      >
        ✕
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-3 text-2xl text-white transition hover:bg-black/70 sm:flex"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-3 text-2xl text-white transition hover:bg-black/70 sm:flex"
          >
            ›
          </button>
        </>
      )}

      {photos.length > 1 && photos.length <= 20 && (
        <div className="absolute bottom-14 left-1/2 flex -translate-x-1/2 gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrent(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-5 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

  const [services, setServices] = useState<Service[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [dailyReportItems, setDailyReportItems] = useState<DailyReportItem[]>([]);
  const [dailyPhotos, setDailyPhotos] = useState<DailyPhoto[]>([]);

  const [searchName, setSearchName] = useState("");
  const [selectedYear, setSelectedYear] = useState("toate");
  const [selectedMonth, setSelectedMonth] = useState("toate");

  const [projectTabs, setProjectTabs] = useState<Record<string, ProjectTab>>({});
  const [tehnicTabs, setTehnicTabs] = useState<Record<string, TehnicTab>>({});

  const [activeInlineProjectId, setActiveInlineProjectId] = useState<string | null>(null);
  const [activeInlineType, setActiveInlineType] = useState<UploadDocType | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [formState, setFormState] = useState<InlineFormState>(createEmptyForm());

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [savingInline, setSavingInline] = useState(false);

  const [devizProjectId, setDevizProjectId] = useState<string | null>(null);
  const [devizDate, setDevizDate] = useState(getTodayDate());
  const [devizItems, setDevizItems] = useState<{ service_id: string; quantity: string }[]>([]);
  const [savingDeviz, setSavingDeviz] = useState(false);
  const [devizReportId, setDevizReportId] = useState<string | null>(null);
  const [serviceSearchByLine, setServiceSearchByLine] = useState<Record<number, string>>({});

  const [photoProjectId, setPhotoProjectId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoViewDate, setPhotoViewDate] = useState<Record<string, string>>({});

  const [lightboxPhotos, setLightboxPhotos] = useState<DailyPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isAdmin = profile?.role === "administrator";

  const openLightbox = (photos: DailyPhoto[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
  };

  const closeLightbox = useCallback(() => {
    setLightboxPhotos([]);
    setLightboxIndex(0);
  }, []);

  const loadData = async () => {
    setLoading(true);

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

    if (profileData.role !== "administrator" && profileData.role !== "sef_echipa") {
      router.push("/dashboard");
      return;
    }

    setProfile(profileData as Profile);

    let visibleProjects: Project[] = [];

    if (profileData.role === "administrator") {
      const { data } = await supabase
        .from("projects")
        .select("id, name, beneficiary, status, created_at")
        .order("created_at", { ascending: true });

      visibleProjects = (data as Project[]) || [];
    } else {
      const { data: linked } = await supabase
        .from("project_team_leads")
        .select("project_id")
        .eq("user_id", user.id);

      const ids = (linked || []).map((r: any) => r.project_id);

      if (ids.length > 0) {
        const { data } = await supabase
          .from("projects")
          .select("id, name, beneficiary, status, created_at")
          .in("id", ids)
          .order("created_at", { ascending: true });

        visibleProjects = (data as Project[]) || [];
      }
    }

    setProjects(visibleProjects);

    const projectIds = visibleProjects.map((p) => p.id);

    if (projectIds.length === 0) {
      setFundings([]);
      setReceipts([]);
      setInvoices([]);
      setNondeductibles([]);
      setServices([]);
      setDailyReports([]);
      setDailyReportItems([]);
      setDailyPhotos([]);
      setLoading(false);
      return;
    }

    const fundingsQuery =
      profileData.role === "sef_echipa"
        ? supabase
            .from("project_fundings")
            .select("project_id, amount_ron")
            .in("project_id", projectIds)
            .eq("team_lead_user_id", user.id)
        : supabase
            .from("project_fundings")
            .select("project_id, amount_ron")
            .in("project_id", projectIds);

    const [
      fundingsRes,
      receiptsRes,
      invoicesRes,
      nondeductiblesRes,
      servicesRes,
      reportsRes,
      reportItemsRes,
      photosRes,
    ] = await Promise.all([
      fundingsQuery,
      supabase.from("fiscal_receipts").select("project_id, total_with_vat").in("project_id", projectIds),
      supabase.from("project_invoices").select("project_id, total_with_vat").in("project_id", projectIds),
      supabase.from("project_nondeductible_expenses").select("project_id, cost_ron").in("project_id", projectIds),
      supabase.from("services").select("id, name, um, price_ron").eq("is_active", true).order("name"),
      supabase
        .from("daily_reports")
        .select("id, project_id, report_date, created_by")
        .in("project_id", projectIds)
        .order("report_date", { ascending: false }),
      supabase.from("daily_report_items").select("id, daily_report_id, service_id, quantity"),
      supabase
        .from("daily_photos")
        .select("id, project_id, photo_date, photo_url, uploaded_by")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true }),
    ]);

    setFundings((fundingsRes.data as ProjectFunding[]) || []);
    setReceipts((receiptsRes.data as FiscalReceipt[]) || []);
    setInvoices((invoicesRes.data as ProjectInvoice[]) || []);
    setNondeductibles((nondeductiblesRes.data as NondeductibleExpense[]) || []);
    setServices((servicesRes.data as Service[]) || []);
    setDailyReports((reportsRes.data as DailyReport[]) || []);
    setDailyReportItems((reportItemsRes.data as DailyReportItem[]) || []);
    setDailyPhotos((photosRes.data as DailyPhoto[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const getProjectTab = (id: string): ProjectTab => projectTabs[id] || "financiar";
  const getTehnicTab = (id: string): TehnicTab => tehnicTabs[id] || "poze";

  const setProjectTab = (id: string, tab: ProjectTab) => {
    setProjectTabs((prev) => ({ ...prev, [id]: tab }));
  };

  const setTehnicTab = (id: string, tab: TehnicTab) => {
    setTehnicTabs((prev) => ({ ...prev, [id]: tab }));
  };

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

    fundings.forEach((r) => {
      map.set(r.project_id, (map.get(r.project_id) || 0) + Number(r.amount_ron || 0));
    });

    return map;
  }, [fundings]);

  const currentCreditByProject = useMemo(() => {
    const map = new Map<string, number>();

    projects.forEach((p) => {
      const funded = fundingTotalsByProject.get(p.id) || 0;

      const spent =
        receipts.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.total_with_vat || 0), 0) +
        invoices.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.total_with_vat || 0), 0) +
        nondeductibles.filter((r) => r.project_id === p.id).reduce((s, r) => s + Number(r.cost_ron || 0), 0);

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

  const resetInlineState = (projectId: string, type: UploadDocType) => {
    setActiveInlineProjectId(projectId);
    setActiveInlineType(type);
    setImagePreview("");
    setUploadedImageUrl("");
    setExtractionError("");
    setFormState(createEmptyForm());
  };

  const openCameraFor = (projectId: string, type: UploadDocType) => {
    resetInlineState(projectId, type);

    if (type === "bon") {
      bonInputRef.current?.click();
    } else {
      facturaInputRef.current?.click();
    }
  };

  const uploadImageToStorage = async (file: File, projectId: string, type: UploadDocType) => {
    setUploadingImage(true);

    const bucket = type === "bon" ? "bonuri-fiscale" : "facturi";
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${projectId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: false });

    if (error) {
      setUploadingImage(false);
      alert(`Eroare: ${error.message}`);
      return "";
    }

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
      items:
        Array.isArray(data.items) && data.items.length > 0
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      const parsed = await res.json();

      if (!res.ok) {
        setExtractionError(parsed.error || "Nu s-au putut extrage datele.");
        return;
      }

      applyExtractedData(parsed);
    } catch {
      setExtractionError("A apărut o eroare la analiza AI.");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  const updateFormField = (field: keyof Omit<InlineFormState, "items">, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof InlineItem, value: string) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setFormState((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }));
  };

  const removeItem = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index),
    }));
  };

  const computedItemsTotal = useMemo(() => {
    return formState.items.reduce((s, item) => s + Number(item.line_total || 0), 0);
  }, [formState.items]);

  const handleSaveInline = async () => {
    if (!activeInlineProjectId || !activeInlineType) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!formState.documentDate) {
      alert("Completează data.");
      return;
    }

    if (!formState.supplier.trim()) {
      alert("Completează furnizorul.");
      return;
    }

    if (!formState.documentNumber.trim()) {
      alert("Completează numărul documentului.");
      return;
    }

    const validItems = formState.items.filter((item) => item.item_name.trim() || Number(item.quantity || 0) > 0);

    if (validItems.length === 0) {
      alert("Adaugă cel puțin un material.");
      return;
    }

    setSavingInline(true);

    if (activeInlineType === "bon") {
      const { data: receiptData, error } = await supabase
        .from("fiscal_receipts")
        .insert({
          project_id: activeInlineProjectId,
          uploaded_by: user.id,
          receipt_image_url: uploadedImageUrl || null,
          receipt_date: formState.documentDate,
          supplier: formState.supplier.trim(),
          document_number: formState.documentNumber.trim(),
          total_without_vat: Number(formState.totalWithoutVat || 0),
          total_with_vat: Number(formState.totalWithVat || 0),
          notes: formState.notes.trim() || null,
        })
        .select("id")
        .single();

      if (error || !receiptData) {
        alert(`Eroare: ${error?.message}`);
        setSavingInline(false);
        return;
      }

      await supabase.from("fiscal_receipt_items").insert(
        validItems.map((item) => ({
          receipt_id: receiptData.id,
          item_name: item.item_name.trim(),
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          line_total: Number(item.line_total || 0),
        }))
      );
    } else {
      const { data: invoiceData, error } = await supabase
        .from("project_invoices")
        .insert({
          project_id: activeInlineProjectId,
          uploaded_by: user.id,
          invoice_image_url: uploadedImageUrl || null,
          invoice_date: formState.documentDate,
          supplier: formState.supplier.trim(),
          document_number: formState.documentNumber.trim(),
          total_without_vat: Number(formState.totalWithoutVat || 0),
          total_with_vat: Number(formState.totalWithVat || 0),
          notes: formState.notes.trim() || null,
        })
        .select("id")
        .single();

      if (error || !invoiceData) {
        alert(`Eroare: ${error?.message}`);
        setSavingInline(false);
        return;
      }

      await supabase.from("project_invoice_items").insert(
        validItems.map((item) => ({
          invoice_id: invoiceData.id,
          item_name: item.item_name.trim(),
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          line_total: Number(item.line_total || 0),
        }))
      );
    }

    setSavingInline(false);
    setActiveInlineProjectId(null);
    setActiveInlineType(null);
    setImagePreview("");
    setUploadedImageUrl("");
    setExtractionError("");
    setFormState(createEmptyForm());

    await loadData();
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files || files.length === 0 || !photoProjectId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setUploadingPhoto(true);

    const today = getTodayDate();

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${photoProjectId}/${today}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("site-photos").upload(fileName, file, { upsert: false });

      if (uploadError) {
        console.error(uploadError);
        continue;
      }

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

  const openDeviz = (projectId: string, date = getTodayDate()) => {
    setDevizProjectId(projectId);
    setDevizDate(date);
    setServiceSearchByLine({});

    const existing = dailyReports.find((r) => r.project_id === projectId && r.report_date === date);

    if (existing) {
      setDevizReportId(existing.id);

      const items = dailyReportItems.filter((i) => i.daily_report_id === existing.id);

      setDevizItems(
        items.map((i) => ({
          service_id: i.service_id,
          quantity: String(i.quantity),
        }))
      );

      const serviceMap = new Map(services.map((s) => [s.id, s]));
      const searches: Record<number, string> = {};

      items.forEach((item, index) => {
        searches[index] = serviceMap.get(item.service_id)?.name || "";
      });

      setServiceSearchByLine(searches);
    } else {
      setDevizReportId(null);
      setDevizItems([{ service_id: "", quantity: "" }]);
    }
  };

  const addDevizLine = () => {
    setDevizItems((prev) => [...prev, { service_id: "", quantity: "" }]);
  };

  const removeDevizLine = (index: number) => {
    setDevizItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
    setServiceSearchByLine((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const numericKey = Number(key);
        if (numericKey < index) next[numericKey] = value;
        if (numericKey > index) next[numericKey - 1] = value;
      });
      return next;
    });
  };

  const updateDevizLine = (index: number, field: "service_id" | "quantity", value: string) => {
    setDevizItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSaveDeviz = async () => {
    if (!devizProjectId || isAdmin) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const validLines = devizItems.filter((l) => l.service_id && Number(l.quantity || 0) > 0);

    if (validLines.length === 0) {
      alert("Adaugă cel puțin un serviciu cu cantitate.");
      return;
    }

    setSavingDeviz(true);

    let reportId = devizReportId;

    if (!reportId) {
      const { data: inserted, error: insertError } = await supabase
        .from("daily_reports")
        .insert({
          project_id: devizProjectId,
          report_date: devizDate,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (insertError) {
        const { data: existing } = await supabase
          .from("daily_reports")
          .select("id")
          .eq("project_id", devizProjectId)
          .eq("report_date", devizDate)
          .single();

        if (!existing) {
          alert(`Eroare: ${insertError.message}`);
          setSavingDeviz(false);
          return;
        }

        reportId = existing.id;
      } else {
        reportId = inserted.id;
      }

      setDevizReportId(reportId);
    }

    await supabase.from("daily_report_items").delete().eq("daily_report_id", reportId);

    const { error: itemsError } = await supabase.from("daily_report_items").insert(
      validLines.map((l) => ({
        daily_report_id: reportId,
        service_id: l.service_id,
        quantity: Number(l.quantity),
      }))
    );

    if (itemsError) {
      alert(`Eroare: ${itemsError.message}`);
      setSavingDeviz(false);
      return;
    }

    setSavingDeviz(false);
    setDevizProjectId(null);
    setServiceSearchByLine({});

    await loadData();
  };

const handleExportDeviz = async (projectId: string, date: string, projectName: string) => {
  const report = dailyReports.find(
    (r) => r.project_id === projectId && r.report_date === date
  );

  if (!report) {
    alert("Nu există deviz pentru această zi.");
    return;
  }

  const items = dailyReportItems.filter((i) => i.daily_report_id === report.id);
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const doc = new jsPDF("p", "mm", "a4");

  // Logo
  try {
    const logo = new window.Image();
    logo.src = "/logo.png";
    await new Promise((resolve) => {
      logo.onload = resolve;
      logo.onerror = resolve;
    });
    doc.addImage(logo, "PNG", 14, 10, 42, 13);
  } catch {
    // dacă nu se încarcă logo-ul, PDF-ul se generează oricum
  }

  // Linie sus
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.6);
  doc.line(14, 28, 196, 28);

  // Titlu
  doc.setFontSize(17);
  doc.setTextColor(20, 83, 45);
  doc.text(`Deviz lucrari - ${projectName}`, 14, 38);

  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Data deviz: ${new Date(date).toLocaleDateString("ro-RO")}`,
    14,
    45
  );
  doc.text(
    `Generat la: ${new Date().toLocaleString("ro-RO")}`,
    14,
    50
  );

  let total = 0;

  const rows = items.map((item, i) => {
    const svc = serviceMap.get(item.service_id);
    const lineTotal = (svc?.price_ron || 0) * item.quantity;
    total += lineTotal;

    return [
      String(i + 1),
      svc?.name || "-",
      svc?.um || "-",
      String(item.quantity),
      `${(svc?.price_ron || 0).toFixed(2)} lei`,
      `${lineTotal.toFixed(2)} lei`,
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: [["Nr.", "Serviciu", "UM", "Cantitate", "Pret unitar", "Total"]],
    body: rows,
    foot: [["", "", "", "", "TOTAL", `${total.toFixed(2)} lei`]],
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [210, 210, 210],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [20, 83, 45],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [20, 83, 45],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    theme: "grid",
  });

  const finalY = (doc as any).lastAutoTable.finalY || 58;

  // Semnătură jos stânga
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Semnatura executant:", 14, finalY + 22);

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(14, finalY + 26, 82, finalY + 26);

  // Text jos
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Document generat automat din aplicatia Brenado Construct.", 14, 287);

  doc.save(`deviz_${projectName.replace(/\s+/g, "_")}_${date}.pdf`);
};

  const photosByProjectAndDate = useMemo(() => {
    const map = new Map<string, Map<string, DailyPhoto[]>>();

    dailyPhotos.forEach((photo) => {
      if (!map.has(photo.project_id)) {
        map.set(photo.project_id, new Map());
      }

      const dateMap = map.get(photo.project_id)!;

      if (!dateMap.has(photo.photo_date)) {
        dateMap.set(photo.photo_date, []);
      }

      dateMap.get(photo.photo_date)!.push(photo);
    });

    return map;
  }, [dailyPhotos]);

  const reportsByProject = useMemo(() => {
    const map = new Map<string, DailyReport[]>();

    dailyReports.forEach((r) => {
      if (!map.has(r.project_id)) {
        map.set(r.project_id, []);
      }

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
      {!isAdmin && (
        <>
          <input
            ref={bonInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleCapturedDocument(e, "bon")}
          />

          <input
            ref={facturaInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleCapturedDocument(e, "factura")}
          />

          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
        </>
      )}

      {lightboxPhotos.length > 0 && (
        <PhotoLightbox photos={lightboxPhotos} initialIndex={lightboxIndex} onClose={closeLightbox} />
      )}

      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image src="/logo.png" alt="Logo" width={140} height={44} className="h-10 w-auto object-contain sm:h-11" />

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
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
            <input
              type="text"
              placeholder="Caută după nume sau beneficiar"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y === "toate" ? "Toți anii" : y}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
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
                const allPhotoDates = projectPhotos ? Array.from(projectPhotos.keys()).sort((a, b) => b.localeCompare(a)) : [];

                const photoViewDateForProject = photoViewDate[project.id] || allPhotoDates[0] || getTodayDate();
                const photosForDate = projectPhotos?.get(photoViewDateForProject) || [];

                const projectReports = reportsByProject.get(project.id) || [];
                const isDevizOpen = devizProjectId === project.id;

                const serviceMap = new Map(services.map((s) => [s.id, s]));

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

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data creare</p>
                          <p className="mt-1 text-sm text-gray-700">{new Date(project.created_at).toLocaleDateString("ro-RO")}</p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Credit curent</p>
                          <p className={`mt-1 text-sm font-bold ${currentCredit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            {currentCredit.toFixed(2)} lei
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProjectTab(project.id, "financiar");
                            setDevizProjectId(null);
                          }}
                          className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                            projectTab === "financiar" ? "bg-[#0196ff] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Financiar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProjectTab(project.id, "tehnic");
                            setDevizProjectId(null);
                          }}
                          className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                            projectTab === "tehnic" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Tehnic
                        </button>
                      </div>

                      {projectTab === "financiar" && (
                        <div className="mt-4 flex flex-col gap-3">
                          {!isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openCameraFor(project.id, "bon")}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#eef6ff] px-4 py-3 text-sm font-semibold text-[#1976d2] transition hover:bg-[#e3f0ff]"
                              >
                                <UploadIcon /> Încarcă Bon
                              </button>

                              <button
                                type="button"
                                onClick={() => openCameraFor(project.id, "factura")}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                              >
                                <UploadIcon /> Încarcă Factură
                              </button>

                              <button
                                type="button"
                                onClick={() => router.push(`/proiecte/${project.id}/adauga-nedeductibile`)}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                              >
                                <UploadIcon /> Adaugă Nedeductibilă
                              </button>
                            </>
                          ) : (
                            <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4 text-center">
                              <p className="text-sm text-gray-400">Documentele financiare sunt gestionate de șeful de echipă.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {projectTab === "tehnic" && (
                        <div className="mt-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTehnicTab(project.id, "poze");
                                setDevizProjectId(null);
                              }}
                              className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition ${
                                tehnicTab === "poze" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                              }`}
                            >
                              Poze
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setTehnicTab(project.id, "deviz");
                                setDevizProjectId(null);
                              }}
                              className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition ${
                                tehnicTab === "deviz" ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                              }`}
                            >
                              Deviz lucrări
                            </button>
                          </div>

                          {tehnicTab === "poze" && (
                            <div className="mt-4 space-y-4">
                              {!isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhotoProjectId(project.id);
                                    setTimeout(() => photoInputRef.current?.click(), 50);
                                  }}
                                  disabled={uploadingPhoto && photoProjectId === project.id}
                                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                                >
                                  <UploadIcon />
                                  {uploadingPhoto && photoProjectId === project.id ? "Se încarcă..." : `Adaugă poze (${getTodayDate()})`}
                                </button>
                              )}

                              {allPhotoDates.length > 0 && (
                                <div>
                                  <div className="mb-2 flex items-center gap-3 px-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Istoric poze</p>
                                    <div className="h-px flex-1 bg-[#E8E5DE]" />
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {allPhotoDates.map((date) => (
                                      <button
                                        key={date}
                                        type="button"
                                        onClick={() =>
                                          setPhotoViewDate((prev) => ({
                                            ...prev,
                                            [project.id]: date,
                                          }))
                                        }
                                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                          photoViewDateForProject === date
                                            ? "bg-amber-500 text-white"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                      >
                                        {new Date(date).toLocaleDateString("ro-RO")}
                                        <span className="ml-1.5 opacity-70">({projectPhotos?.get(date)?.length || 0})</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {photosForDate.length > 0 && (
                                <div>
                                  <p className="mb-2 text-xs font-semibold text-gray-500">
                                    {new Date(photoViewDateForProject).toLocaleDateString("ro-RO")} — {photosForDate.length}{" "}
                                    {photosForDate.length === 1 ? "poză" : "poze"}
                                    <span className="ml-2 text-gray-400">· Apasă pe o poză pentru mărire · Swipe stânga/dreapta</span>
                                  </p>

                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {photosForDate.map((photo, idx) => (
                                      <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => openLightbox(photosForDate, idx)}
                                        className="overflow-hidden rounded-2xl focus:outline-none"
                                      >
                                        <img
                                          src={photo.photo_url}
                                          alt="Poză șantier"
                                          className="h-28 w-full rounded-2xl object-cover transition hover:opacity-90 sm:h-36"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {allPhotoDates.length === 0 && (
                                <p className="text-sm text-gray-400">Nu există poze încărcate pentru acest proiect.</p>
                              )}
                            </div>
                          )}

                          {tehnicTab === "deviz" && (
                            <div className="mt-4 space-y-4">
                              {projectReports.length > 0 && (
                                <div>
                                  <div className="mb-2 flex items-center gap-3 px-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Devize</p>
                                    <div className="h-px flex-1 bg-[#E8E5DE]" />
                                  </div>

                                  <div className="space-y-2">
                                    {projectReports.map((report) => {
                                      const items = dailyReportItems.filter((i) => i.daily_report_id === report.id);

                                      const total = items.reduce((s, item) => {
                                        const svc = serviceMap.get(item.service_id);
                                        return s + (svc?.price_ron || 0) * item.quantity;
                                      }, 0);

                                      return (
                                        <div key={report.id} className="rounded-2xl border border-gray-200 bg-[#F8F7F3] px-4 py-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">
                                                {new Date(report.report_date).toLocaleDateString("ro-RO")}
                                              </p>
                                              <p className="text-xs text-gray-500">{items.length} servicii</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {isAdmin && (
                                                <>
                                                  <p className="text-sm font-bold text-teal-700">{total.toFixed(2)} lei</p>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleExportDeviz(project.id, report.report_date, project.name)}
                                                    className="rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                                                  >
                                                    Export PDF
                                                  </button>
                                                </>
                                              )}

                                              {!isAdmin && (
                                                <button
                                                  type="button"
                                                  onClick={() => openDeviz(project.id, report.report_date)}
                                                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                                >
                                                  Editează
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {items.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                              {items.map((item) => {
                                                const svc = serviceMap.get(item.service_id);
                                                const lineTotal = (svc?.price_ron || 0) * item.quantity;

                                                return (
                                                  <div
                                                    key={item.id}
                                                    className="grid grid-cols-[1fr_auto] gap-2 text-xs sm:grid-cols-[1fr_auto_auto]"
                                                  >
                                                    <span className="text-gray-700">{svc?.name || "-"}</span>

                                                    <span className="text-gray-500">
                                                      {item.quantity} {svc?.um}
                                                    </span>

                                                    {isAdmin && (
                                                      <span className="text-right font-medium text-gray-900">{lineTotal.toFixed(2)} lei</span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {!isAdmin && isDevizOpen && (
                                <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                                  <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-teal-900">
                                        Deviz — {new Date(devizDate).toLocaleDateString("ro-RO")}
                                      </p>
                                      <p className="text-xs text-teal-700">Adaugă serviciile efectuate</p>
                                    </div>

                                    <input
                                      type="date"
                                      value={devizDate}
                                      onChange={(e) => openDeviz(project.id, e.target.value)}
                                      className="rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs outline-none focus:border-teal-500"
                                    />
                                  </div>

                                  <div className="space-y-3">
                                    {devizItems.map((line, index) => {
                                      const selectedSvc = services.find((s) => s.id === line.service_id);
                                      const searchValue = serviceSearchByLine[index] || "";
                                      const filteredServices = services
                                        .filter((svc) => svc.name.toLowerCase().includes(searchValue.toLowerCase()))
                                        .slice(0, 30);

                                      return (
                                        <div key={index} className="rounded-xl border border-teal-200 bg-white p-3">
                                          <div className="flex items-start gap-2">
                                            <div className="flex-1 space-y-3">
                                              <div className="rounded-xl border border-gray-200 bg-white p-2">
                                                <input
                                                  type="text"
                                                  value={searchValue}
                                                  onChange={(e) => {
                                                    const value = e.target.value;

                                                    setServiceSearchByLine((prev) => ({
                                                      ...prev,
                                                      [index]: value,
                                                    }));

                                                    updateDevizLine(index, "service_id", "");
                                                  }}
                                                  placeholder="Caută serviciu..."
                                                  className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-500"
                                                />

                                               <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                                                  {filteredServices.map((svc) => {
                                                    const selected = line.service_id === svc.id;

                                                    return (
                                                      <button
                                                        key={svc.id}
                                                        type="button"
                                                        onClick={() => {
                                                          updateDevizLine(index, "service_id", svc.id);
                                                          setServiceSearchByLine((prev) => ({
                                                            ...prev,
                                                            [index]: svc.name,
                                                          }));
                                                        }}
                                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                                                          selected
                                                            ? "bg-teal-600 text-white"
                                                            : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                                                        }`}
                                                      >
                                                        <span className="font-medium">{svc.name}</span>
                                                        <span className={selected ? "text-white/80" : "text-gray-400"}>{svc.um}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                {filteredServices.length === 0 && (
                                                  <p className="px-2 py-2 text-xs text-gray-400">Nu s-a găsit niciun serviciu.</p>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={line.quantity}
                                                  onChange={(e) => updateDevizLine(index, "quantity", e.target.value)}
                                                  placeholder="Cantitate"
                                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-500"
                                                />

                                                {selectedSvc && <span className="shrink-0 text-sm font-medium text-gray-500">{selectedSvc.um}</span>}
                                              </div>
                                            </div>

                                            {devizItems.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => removeDevizLine(index)}
                                                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                    <button
                                      type="button"
                                      onClick={addDevizLine}
                                      className="rounded-xl border border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                                    >
                                      + Adaugă serviciu
                                    </button>

                                    <button
                                      type="button"
                                      onClick={handleSaveDeviz}
                                      disabled={savingDeviz}
                                      className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    >
                                      {savingDeviz ? "Se salvează..." : "Salvează devizul"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDevizProjectId(null);
                                        setServiceSearchByLine({});
                                      }}
                                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                    >
                                      Închide
                                    </button>
                                  </div>
                                </div>
                              )}

                              {!isAdmin && !isDevizOpen && (
                                <button
                                  type="button"
                                  onClick={() => openDeviz(project.id)}
                                  className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                  {projectReports.length === 0 ? "+ Creează deviz pentru azi" : "+ Deviz nou pentru azi"}
                                </button>
                              )}

                              {isAdmin && projectReports.length === 0 && (
                                <p className="text-sm text-gray-400">Șeful de echipă nu a adăugat încă devize pentru acest proiect.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!isAdmin && activeInlineProjectId === project.id && projectTab === "financiar" && (
                      <div className="border-t border-[#E8E5DE] bg-[#FCFBF8] p-4 sm:p-5">
                        <div className="mb-4">
                          <p className="text-base font-semibold text-gray-900">
                            {activeInlineType === "bon" ? "Card bon fiscal" : "Card factură"}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">Datele sunt extrase automat și pot fi corectate.</p>
                        </div>

                        {imagePreview && (
                          <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                            <img src={imagePreview} alt="Preview" className="max-h-[420px] w-full rounded-xl object-contain" />
                          </div>
                        )}

                        {uploadingImage && (
                          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                            <p className="text-sm font-medium text-blue-800">Se încarcă imaginea...</p>
                          </div>
                        )}

                        {isExtracting && (
                          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
                            <p className="text-sm font-medium text-purple-800">AI analizează documentul...</p>
                          </div>
                        )}

                        {extractionError && (
                          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-sm font-medium text-red-700">{extractionError}</p>
                          </div>
                        )}

                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Data</label>
                              <input
                                type="date"
                                value={formState.documentDate}
                                onChange={(e) => updateFormField("documentDate", e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Număr document</label>
                              <input
                                type="text"
                                value={formState.documentNumber}
                                onChange={(e) => updateFormField("documentNumber", e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-gray-700">Furnizor</label>
                              <input
                                type="text"
                                value={formState.supplier}
                                onChange={(e) => updateFormField("supplier", e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Total fără TVA</label>
                              <input
                                type="number"
                                step="0.01"
                                value={formState.totalWithoutVat}
                                onChange={(e) => updateFormField("totalWithoutVat", e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Total cu TVA</label>
                              <input
                                type="number"
                                step="0.01"
                                value={formState.totalWithVat}
                                onChange={(e) => updateFormField("totalWithVat", e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-gray-700">Observații</label>
                              <textarea
                                value={formState.notes}
                                onChange={(e) => updateFormField("notes", e.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-gray-900">Materiale</h3>

                            <button
                              type="button"
                              onClick={addItem}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                                activeInlineType === "bon" ? "bg-[#0196ff]" : "bg-purple-600"
                              }`}
                            >
                              + Adaugă
                            </button>
                          </div>

                          <div className="space-y-3">
                            {formState.items.map((item, index) => (
                              <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-800">Material {index + 1}</p>

                                  {formState.items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeItem(index)}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                      Șterge
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                  <div className="md:col-span-4">
                                    <input
                                      type="text"
                                      value={item.item_name}
                                      onChange={(e) => updateItem(index, "item_name", e.target.value)}
                                      placeholder="Denumire material"
                                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                                    />
                                  </div>

                                  <div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                      placeholder="Cantitate"
                                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                                    />
                                  </div>

                                  <div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                      placeholder="Preț unitar"
                                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                                    />
                                  </div>

                                  <div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.line_total}
                                      onChange={(e) => updateItem(index, "line_total", e.target.value)}
                                      placeholder="Total linie"
                                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div
                            className={`mt-4 rounded-xl px-4 py-3 ${
                              activeInlineType === "bon" ? "border border-blue-200 bg-blue-50" : "border border-purple-200 bg-purple-50"
                            }`}
                          >
                            <p className={`text-sm font-medium ${activeInlineType === "bon" ? "text-blue-800" : "text-purple-800"}`}>
                              Total materiale: {computedItemsTotal.toFixed(2)} lei
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleSaveInline}
                            disabled={savingInline || uploadingImage || isExtracting}
                            className="w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                          >
                            {savingInline ? "Se salvează..." : activeInlineType === "bon" ? "Salvează Bon" : "Salvează Factură"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveInlineProjectId(null);
                              setActiveInlineType(null);
                              setImagePreview("");
                              setUploadedImageUrl("");
                              setExtractionError("");
                              setFormState(createEmptyForm());
                            }}
                            className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            Renunță
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}