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
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BottomNav from "@/components/BottomNav";
import { createNotificationForMany, getUserIdsByRoles } from "@/lib/notifications";

type Role = "administrator" | "cont_tehnic" | "project_manager" | "admin_limitat" | "sef_echipa" | "user";
type Profile = { id: string; full_name: string; role: Role };

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  status: string | null;
  created_at: string;
};

type ProjectFunding = { project_id: string; amount_ron: number | null };

type FiscalReceipt = {
  id: string;
  project_id: string;
  supplier: string | null;
  document_number: string | null;
  receipt_date: string | null;
  total_with_vat: number | null;
  total_without_vat: number | null;
  notes: string | null;
  receipt_image_url: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

type ProjectInvoice = {
  id: string;
  project_id: string;
  supplier: string | null;
  document_number: string | null;
  invoice_date: string | null;
  total_with_vat: number | null;
  total_without_vat: number | null;
  notes: string | null;
  invoice_image_url: string | null;
  uploaded_by: string | null;
  created_at: string | null;
};

type NondeductibleExpense = {
  id: string;
  project_id: string;
  service_name: string | null;
  expense_date: string | null;
  cost_ron: number | null;
  notes: string | null;
  added_by: string | null;
  created_at: string | null;
};

type FinancialDoc =
  | { kind: "bon"; data: FiscalReceipt }
  | { kind: "factura"; data: ProjectInvoice }
  | { kind: "nedeductibila"; data: NondeductibleExpense };

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
  const searchParams = useSearchParams();

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
  const [showDevizValidation, setShowDevizValidation] = useState(false);
  const [servicePickerLine, setServicePickerLine] = useState<number | null>(null);
  const [servicePickerSearch, setServicePickerSearch] = useState("");

  const [photoProjectId, setPhotoProjectId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // NEW: filtrare pe data + expand pentru poze, devize, financiar
  const [photoDateFilter, setPhotoDateFilter] = useState<Record<string, string>>({});
  const [devizDateFilter, setDevizDateFilter] = useState<Record<string, string>>({});
  const [finDateFilter, setFinDateFilter] = useState<Record<string, string>>({});
  const [photoExpand, setPhotoExpand] = useState<Record<string, boolean>>({});
  const [devizExpand, setDevizExpand] = useState<Record<string, boolean>>({});
  const [finExpand, setFinExpand] = useState<Record<string, boolean>>({});

  // NEW: modal pentru poze pe zi
  const [photosModal, setPhotosModal] = useState<{
    projectId: string;
    date: string;
    photos: DailyPhoto[];
  } | null>(null);

  // NEW: modal pentru deviz pe zi
  const [devizModal, setDevizModal] = useState<{
    projectId: string;
    projectName: string;
    date: string;
    reportId: string;
  } | null>(null);

  // NEW: modal pentru document financiar (admin)
  const [financialDocModal, setFinancialDocModal] = useState<FinancialDoc | null>(null);

  const [lightboxPhotos, setLightboxPhotos] = useState<DailyPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Ștergere proiect (admin)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteProjectPassword, setDeleteProjectPassword] = useState("");
  const [deleteProjectPasswordError, setDeleteProjectPasswordError] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);

  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ projectId: string; currentStatus: string | null } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const isAdmin = ["administrator", "cont_tehnic", "project_manager"].includes(profile?.role || "");
  const isAdminLimitat = profile?.role === "admin_limitat";
  const isProjectManager = profile?.role === "project_manager";
  const canManageProjects = isAdmin || isProjectManager;
  const canAddPhotos = profile?.role === "sef_echipa" || isProjectManager;
  const canCreateDeviz = profile?.role === "sef_echipa" || profile?.role === "project_manager";

  const openLightbox = (photos: DailyPhoto[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
  };

  const closeLightbox = useCallback(() => {
    setLightboxPhotos([]);
    setLightboxIndex(0);
  }, []);

  const openDeleteProject = (projectId: string) => {
    setDeleteProjectId(projectId);
    setDeleteProjectPassword("");
    setDeleteProjectPasswordError("");
  };

  const handleUpdateStatus = async () => {
    if (!statusModal || !pendingStatus) return;
    const projectId = statusModal.projectId;
    setSavingStatusId(projectId);
    const { error } = await supabase
      .from("projects")
      .update({ status: pendingStatus })
      .eq("id", projectId);
    if (error) {
      alert(`Eroare la actualizarea statusului: ${error.message}`);
    } else {
      setProjects((prev) =>
        prev.map((p) => p.id === projectId ? { ...p, status: pendingStatus } : p)
      );

      // Notificari schimbare status
      const projectName = projects.find((p) => p.id === projectId)?.name || "-";
      const recipientIds = await getUserIdsByRoles(["administrator", "cont_tehnic", "project_manager", "admin_limitat"]);

      if (pendingStatus === "finalizat") {
        await createNotificationForMany(recipientIds, {
          title: "Șantier finalizat",
          message: `Șantierul ${projectName} a fost marcat ca finalizat. Vezi centrul de cost.`,
          type: "success",
          link: `/admin/centre-de-cost`,
        });
      } else if (pendingStatus === "in_lucru") {
        await createNotificationForMany(recipientIds, {
          title: "Șantier în lucru",
          message: `Șantierul ${projectName} a fost trecut în lucru.`,
          type: "info",
          link: `/proiecte`,
        });
      }
    }
    setSavingStatusId(null);
    setStatusModal(null);
    setPendingStatus(null);
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;

    if (deleteProjectPassword !== "brenado***") {
      setDeleteProjectPasswordError("Parolă incorectă. Încearcă din nou.");
      return;
    }

    setDeletingProject(true);
    const pid = deleteProjectId;

    try {
      // ── NO ACTION FK-uri — trebuie șterse manual înainte de projects ──

      // 1. extra_work (NO ACTION)
      const { error: e1 } = await supabase.from("extra_work").delete().eq("project_id", pid);
      if (e1) throw new Error(`extra_work: ${e1.message}`);

      // 2. daily_photos (NO ACTION)
      const { error: e2 } = await supabase.from("daily_photos").delete().eq("project_id", pid);
      if (e2) throw new Error(`daily_photos: ${e2.message}`);

      // 3. daily_report_items → daily_reports (NO ACTION)
      const { data: reportsData } = await supabase
        .from("daily_reports").select("id").eq("project_id", pid);
      const reportIds = (reportsData || []).map((r: any) => r.id);
      if (reportIds.length > 0) {
        const { error: e3a } = await supabase
          .from("daily_report_items").delete().in("daily_report_id", reportIds);
        if (e3a) throw new Error(`daily_report_items: ${e3a.message}`);
      }
      const { error: e3b } = await supabase.from("daily_reports").delete().eq("project_id", pid);
      if (e3b) throw new Error(`daily_reports: ${e3b.message}`);

      // 4. estimate_items → estimates (NO ACTION)
      const { data: estimatesData } = await supabase
        .from("estimates").select("id").eq("project_id", pid);
      const estimateIds = (estimatesData || []).map((e: any) => e.id);
      if (estimateIds.length > 0) {
        const { error: e4a } = await supabase
          .from("estimate_items").delete().in("estimate_id", estimateIds);
        if (e4a) throw new Error(`estimate_items: ${e4a.message}`);
      }
      const { error: e4b } = await supabase.from("estimates").delete().eq("project_id", pid);
      if (e4b) throw new Error(`estimates: ${e4b.message}`);

      // 5. funding_requests (NO ACTION)
      const { error: e5 } = await supabase.from("funding_requests").delete().eq("project_id", pid);
      if (e5) throw new Error(`funding_requests: ${e5.message}`);

      // ── CASCADE FK-uri — se șterg automat, dar ștergem și copiii explicit ──

      // 6. fiscal_receipt_items → fiscal_receipts (CASCADE pe fiscal_receipts)
      const { data: receiptsData } = await supabase
        .from("fiscal_receipts").select("id").eq("project_id", pid);
      const receiptIds = (receiptsData || []).map((r: any) => r.id);
      if (receiptIds.length > 0) {
        await supabase.from("fiscal_receipt_items").delete().in("receipt_id", receiptIds);
      }

      // 7. project_invoice_items → project_invoices (CASCADE)
      const { data: invoicesData } = await supabase
        .from("project_invoices").select("id").eq("project_id", pid);
      const invoiceIds = (invoicesData || []).map((i: any) => i.id);
      if (invoiceIds.length > 0) {
        await supabase.from("project_invoice_items").delete().in("invoice_id", invoiceIds);
      }

      // 8. order_items → orders (CASCADE)
      const { data: ordersData } = await supabase
        .from("orders").select("id").eq("project_id", pid);
      const orderIds = (ordersData || []).map((o: any) => o.id);
      if (orderIds.length > 0) {
        await supabase.from("order_items").delete().in("order_id", orderIds);
      }

      // 9. daily_team_workers + daily_team_vehicles → daily_teams (CASCADE)
      const { data: teamsData } = await supabase
        .from("daily_teams").select("id").eq("project_id", pid);
      const teamIds = (teamsData || []).map((t: any) => t.id);
      if (teamIds.length > 0) {
        await supabase.from("daily_team_workers").delete().in("daily_team_id", teamIds);
        await supabase.from("daily_team_vehicles").delete().in("daily_team_id", teamIds);
      }

      // 10. Șterge proiectul — CASCADE face restul automat:
      //     daily_teams, fiscal_receipts, project_invoices, orders,
      //     project_fundings, project_nondeductible_expenses,
      //     project_team_leads, project_workers, time_entries
      const { error: deleteError } = await supabase
        .from("projects").delete().eq("id", pid);
      if (deleteError) throw new Error(`projects: ${deleteError.message}`);

      setDeletingProject(false);
      setDeleteProjectId(null);
      setDeleteProjectPassword("");
      setDeleteProjectPasswordError("");
      await loadData();

    } catch (err: any) {
      alert(`Eroare la ștergerea proiectului: ${err?.message || "Eroare necunoscută"}`);
      setDeletingProject(false);
    }
  };

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

    const allowedRoles = ["administrator", "cont_tehnic", "project_manager", "admin_limitat", "sef_echipa"];
    if (!allowedRoles.includes(profileData.role)) {
      router.push("/dashboard");
      return;
    }

    setProfile(profileData as Profile);

    let visibleProjects: Project[] = [];

    if (["administrator", "cont_tehnic", "project_manager", "admin_limitat"].includes(profileData.role)) {
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
          .eq("status", "in_lucru")
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
      supabase
        .from("fiscal_receipts")
        .select("id, project_id, supplier, document_number, receipt_date, total_with_vat, total_without_vat, notes, receipt_image_url, uploaded_by, created_at")
        .in("project_id", projectIds)
        .order("receipt_date", { ascending: false }),
      supabase
        .from("project_invoices")
        .select("id, project_id, supplier, document_number, invoice_date, total_with_vat, total_without_vat, notes, invoice_image_url, uploaded_by, created_at")
        .in("project_id", projectIds)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("project_nondeductible_expenses")
        .select("id, project_id, service_name, expense_date, cost_ron, notes, added_by, created_at")
        .in("project_id", projectIds)
        .order("expense_date", { ascending: false }),
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

  // Auto-open document modal from notification link
  useEffect(() => {
    if (loading) return;
    const openDoc = searchParams.get("openDoc");
    if (!openDoc) return;
    const [kind, id] = openDoc.split(":");
    if (!kind || !id) return;

    let doc: FinancialDoc | null = null;
    if (kind === "bon") {
      const found = receipts.find((r) => r.id === id);
      if (found) doc = { kind: "bon", data: found };
    } else if (kind === "factura") {
      const found = invoices.find((r) => r.id === id);
      if (found) doc = { kind: "factura", data: found };
    } else if (kind === "nedeductibila") {
      const found = nondeductibles.find((r) => r.id === id);
      if (found) doc = { kind: "nedeductibila", data: found };
    }

    if (doc) {
      const projectId = (doc as any).data.project_id;
      if (projectId) setProjectTab(projectId, "financiar");
      setFinancialDocModal(doc);
    }
  }, [loading, searchParams, receipts, invoices, nondeductibles]);

  const getProjectTab = (id: string): ProjectTab => projectTabs[id] || "financiar";
  const getTehnicTab = (id: string): TehnicTab => tehnicTabs[id] || "poze";

  const setProjectTab = (id: string, tab: ProjectTab) => {
    setProjectTabs((prev) => ({ ...prev, [id]: tab }));
  };

  const setTehnicTab = (id: string, tab: TehnicTab) => {
    setTehnicTabs((prev) => ({ ...prev, [id]: tab }));
  };

  const filteredProjects = useMemo(() => {
    const q = searchName.toLowerCase();
    const statusOrder: Record<string, number> = { "in_lucru": 0, "in_asteptare": 1, "finalizat": 2 };
    return projects
      .filter((p) => p.name.toLowerCase().includes(q) || (p.beneficiary || "").toLowerCase().includes(q))
      .sort((a, b) => (statusOrder[a.status || ""] ?? 1) - (statusOrder[b.status || ""] ?? 1));
  }, [projects, searchName]);

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

  // NEW: detecție duplicat în timp real (număr document + dată) pentru bon/factură
  const duplicateWarning = useMemo(() => {
    if (!activeInlineProjectId || !activeInlineType) return null;
    if (!formState.documentNumber.trim() || !formState.documentDate) return null;

    const docNum = formState.documentNumber.trim().toLowerCase();
    const docDate = formState.documentDate;

    if (activeInlineType === "bon") {
      const found = receipts.find(
        (r) =>
          r.project_id === activeInlineProjectId &&
          (r.document_number || "").trim().toLowerCase() === docNum &&
          r.receipt_date === docDate
      );
      if (found) {
        return `Există deja un bon cu numărul „${found.document_number}" din ${
          found.receipt_date
            ? new Date(found.receipt_date).toLocaleDateString("ro-RO")
            : "-"
        }${found.supplier ? ` (furnizor: ${found.supplier})` : ""} pentru acest proiect.`;
      }
    }

    if (activeInlineType === "factura") {
      const found = invoices.find(
        (r) =>
          r.project_id === activeInlineProjectId &&
          (r.document_number || "").trim().toLowerCase() === docNum &&
          r.invoice_date === docDate
      );
      if (found) {
        return `Există deja o factură cu numărul „${found.document_number}" din ${
          found.invoice_date
            ? new Date(found.invoice_date).toLocaleDateString("ro-RO")
            : "-"
        }${found.supplier ? ` (furnizor: ${found.supplier})` : ""} pentru acest proiect.`;
      }
    }

    return null;
  }, [
    activeInlineProjectId,
    activeInlineType,
    formState.documentNumber,
    formState.documentDate,
    receipts,
    invoices,
  ]);

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

    // Protecție anti-duplicat la salvare
    if (duplicateWarning) {
      alert(`Nu se poate salva: ${duplicateWarning}`);
      return;
    }

    const validItems = formState.items.filter((item) => item.item_name.trim() || Number(item.quantity || 0) > 0);

    if (validItems.length === 0) {
      alert("Adaugă cel puțin un material.");
      return;
    }

    setSavingInline(true);

    let insertedDocId: string | null = null;

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

      insertedDocId = receiptData.id;

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

      insertedDocId = invoiceData.id;

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

    // Notificare upload document financiar → admin + cont_tehnic + admin_limitat
    const uploaderProfile = profile;
    if (uploaderProfile && activeInlineProjectId) {
      const projectName = projects.find((p) => p.id === activeInlineProjectId)?.name || "-";
      const uploaderName = uploaderProfile.full_name;
      const docLabel = activeInlineType === "bon" ? "bon fiscal" : "factură";
      const recipientIds = await getUserIdsByRoles(["administrator", "cont_tehnic", "admin_limitat"]);
      const docKind = activeInlineType === "bon" ? "bon" : "factura";
      const linkUrl = insertedDocId ? `/proiecte?openDoc=${docKind}:${insertedDocId}` : `/proiecte`;
      await createNotificationForMany(recipientIds, {
        title: `${activeInlineType === "bon" ? "Bon fiscal" : "Factură"} încărcat`,
        message: `${uploaderName} a încărcat un ${docLabel} în șantierul ${projectName}.`,
        type: "info",
        link: linkUrl,
      });
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
    setShowDevizValidation(false);

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

  // Validare deviz: fiecare rând trebuie să aibă serviciu + cantitate > 0
  const isDevizLineValid = (line: { service_id: string; quantity: string }) =>
    Boolean(line.service_id) && Number(line.quantity || 0) > 0;

  const isDevizFullyValid = useMemo(() => {
    return devizItems.length > 0 && devizItems.every(isDevizLineValid);
  }, [devizItems]);

  const handleSaveDeviz = async () => {
    if (!devizProjectId || !canCreateDeviz) return;

    // Validare strictă: serviciu + cantitate obligatorii pe fiecare linie
    if (!isDevizFullyValid) {
      setShowDevizValidation(true);
      alert("Fiecare rând trebuie să aibă un serviciu selectat și o cantitate mai mare ca 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

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
      devizItems.map((l) => ({
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
    setShowDevizValidation(false);

    await loadData();
  };

  const handleExportDeviz = async (projectId: string, date: string, projectName: string) => {
    const report = dailyReports.find((r) => r.project_id === projectId && r.report_date === date);

    if (!report) {
      alert("Nu există deviz pentru această zi.");
      return;
    }

    const items = dailyReportItems.filter((i) => i.daily_report_id === report.id);
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const doc = new jsPDF("p", "mm", "a4");

    try {
      const logo = new window.Image();
      logo.src = "/logo.png";
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve;
      });
      doc.addImage(logo, "PNG", 14, 10, 42, 13);
    } catch {}

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.6);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(17);
    doc.setTextColor(20, 83, 45);
    doc.text(`Deviz lucrari - ${projectName}`, 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Data deviz: ${new Date(date).toLocaleDateString("ro-RO")}`, 14, 45);
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 50);

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

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Semnatura executant:", 14, finalY + 22);

    try {
      const stampila = new window.Image();
      stampila.src = "/stampila.png";

      await new Promise((resolve) => {
        stampila.onload = resolve;
        stampila.onerror = resolve;
      });

      doc.addImage(stampila, "PNG", 11, finalY + 26, 35, 28);
    } catch {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Stampila indisponibila", 14, finalY + 30);
    }

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

  // Total per zi pentru fiecare proiect (folosit la totaluri admin)
  const reportTotalById = useMemo(() => {
    const map = new Map<string, number>();
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    dailyReports.forEach((report) => {
      const items = dailyReportItems.filter((i) => i.daily_report_id === report.id);
      const total = items.reduce((s, item) => {
        const svc = serviceMap.get(item.service_id);
        return s + (svc?.price_ron || 0) * item.quantity;
      }, 0);
      map.set(report.id, total);
    });

    return map;
  }, [dailyReports, dailyReportItems, services]);

  // Istoric financiar combinat per proiect (admin) — sortat descrescător după dată
  const financialDocsByProject = useMemo(() => {
    const map = new Map<string, FinancialDoc[]>();

    receipts.forEach((r) => {
      const arr = map.get(r.project_id) || [];
      arr.push({ kind: "bon", data: r });
      map.set(r.project_id, arr);
    });

    invoices.forEach((r) => {
      const arr = map.get(r.project_id) || [];
      arr.push({ kind: "factura", data: r });
      map.set(r.project_id, arr);
    });

    nondeductibles.forEach((r) => {
      const arr = map.get(r.project_id) || [];
      arr.push({ kind: "nedeductibila", data: r });
      map.set(r.project_id, arr);
    });

    // Sortare descrescătoare după data documentului
    map.forEach((arr) => {
      arr.sort((a, b) => {
        const dateA =
          a.kind === "bon"
            ? a.data.receipt_date
            : a.kind === "factura"
            ? a.data.invoice_date
            : a.data.expense_date;
        const dateB =
          b.kind === "bon"
            ? b.data.receipt_date
            : b.kind === "factura"
            ? b.data.invoice_date
            : b.data.expense_date;
        return (dateB || "").localeCompare(dateA || "");
      });
    });

    return map;
  }, [receipts, invoices, nondeductibles]);

  // Helper: extrage data unui document financiar
  const getFinDocDate = (doc: FinancialDoc): string => {
    if (doc.kind === "bon") return doc.data.receipt_date || "";
    if (doc.kind === "factura") return doc.data.invoice_date || "";
    return doc.data.expense_date || "";
  };

  // Helper: extrage suma unui document financiar
  const getFinDocAmount = (doc: FinancialDoc): number => {
    if (doc.kind === "bon") return Number(doc.data.total_with_vat || 0);
    if (doc.kind === "factura") return Number(doc.data.total_with_vat || 0);
    return Number(doc.data.cost_ron || 0);
  };

  // Helper: extrage label-ul de identificare (numar document sau service_name)
  const getFinDocLabel = (doc: FinancialDoc): string => {
    if (doc.kind === "bon") return doc.data.document_number || "fără număr";
    if (doc.kind === "factura") return doc.data.document_number || "fără număr";
    return doc.data.service_name || "fără serviciu";
  };

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

  // Date pentru modalul de deviz deschis
  const devizModalReport = devizModal
    ? dailyReports.find((r) => r.id === devizModal.reportId)
    : null;
  const devizModalItems = devizModalReport
    ? dailyReportItems.filter((i) => i.daily_report_id === devizModalReport.id)
    : [];
  const serviceMapAll = new Map(services.map((s) => [s.id, s]));
  const devizModalTotal = devizModalItems.reduce((s, item) => {
    const svc = serviceMapAll.get(item.service_id);
    return s + (svc?.price_ron || 0) * item.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      {(profile?.role === "sef_echipa" || profile?.role === "admin_limitat" || profile?.role === "project_manager") && (
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

      {/* MODAL POZE PE ZI */}
      {photosModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setPhotosModal(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-base font-bold text-gray-900">
                  Poze {new Date(photosModal.date).toLocaleDateString("ro-RO")}
                </p>
                <p className="text-xs text-gray-500">
                  {photosModal.photos.length} {photosModal.photos.length === 1 ? "poză" : "poze"} · Apasă pe o poză pentru zoom
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotosModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photosModal.photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => openLightbox(photosModal.photos, idx)}
                    className="overflow-hidden rounded-2xl focus:outline-none"
                  >
                    <img
                      src={photo.photo_url}
                      alt="Poză șantier"
                      className="h-32 w-full rounded-2xl object-cover transition hover:opacity-90 sm:h-40"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEVIZ PE ZI */}
      {devizModal && devizModalReport && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setDevizModal(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-base font-bold text-gray-900">
                  Deviz {new Date(devizModal.date).toLocaleDateString("ro-RO")}
                </p>
                <p className="text-xs text-gray-500">{devizModal.projectName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDevizModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {devizModalItems.length === 0 ? (
                <p className="text-sm text-gray-400">Nu există servicii în acest deviz.</p>
              ) : (
                <div className="space-y-2">
                  {devizModalItems.map((item, idx) => {
                    const svc = serviceMapAll.get(item.service_id);
                    const lineTotal = (svc?.price_ron || 0) * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-[#F8F7F3] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {idx + 1}. {svc?.name || "-"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} {svc?.um} × {(svc?.price_ron || 0).toFixed(2)} lei
                          </p>
                        </div>
                        {canManageProjects && (
                          <p className="shrink-0 text-sm font-bold text-teal-700">{lineTotal.toFixed(2)} lei</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-[#FCFBF8] px-5 py-4">
              {canManageProjects && (
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Total deviz</p>
                  <p className="text-lg font-bold text-teal-700">{devizModalTotal.toFixed(2)} lei</p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                {canManageProjects && (
                  <button
                    type="button"
                    onClick={() => handleExportDeviz(devizModal.projectId, devizModal.date, devizModal.projectName)}
                    className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Export PDF
                  </button>
                )}

                {canCreateDeviz && (
                  <button
                    type="button"
                    onClick={() => {
                      const projectId = devizModal.projectId;
                      const date = devizModal.date;
                      setDevizModal(null);
                      openDeviz(projectId, date);
                    }}
                    className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Editează deviz
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDevizModal(null)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Închide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALII DOCUMENT FINANCIAR (admin) */}
      {financialDocModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setFinancialDocModal(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-extrabold ${
                    financialDocModal.kind === "bon"
                      ? "bg-blue-100 text-blue-700"
                      : financialDocModal.kind === "factura"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {financialDocModal.kind === "bon" ? "B" : financialDocModal.kind === "factura" ? "F" : "N"}
                </span>
                <p className="text-base font-bold text-gray-900">
                  {financialDocModal.kind === "bon"
                    ? "Bon fiscal"
                    : financialDocModal.kind === "factura"
                    ? "Factură"
                    : "Nedeductibilă"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinancialDocModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {financialDocModal.kind === "bon" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {financialDocModal.data.receipt_date
                          ? new Date(financialDocModal.data.receipt_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Număr document</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{financialDocModal.data.document_number || "-"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Furnizor</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{financialDocModal.data.supplier || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Total fără TVA</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {Number(financialDocModal.data.total_without_vat || 0).toFixed(2)} lei
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Total cu TVA</p>
                      <p className="mt-1 text-sm font-bold text-blue-700">
                        {Number(financialDocModal.data.total_with_vat || 0).toFixed(2)} lei
                      </p>
                    </div>
                  </div>

                  {financialDocModal.data.notes && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Observații</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{financialDocModal.data.notes}</p>
                    </div>
                  )}

                  {financialDocModal.data.receipt_image_url && (
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-gray-400">Document atașat</p>
                      <a
                        href={financialDocModal.data.receipt_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-2xl border border-gray-200"
                      >
                        <img
                          src={financialDocModal.data.receipt_image_url}
                          alt="Bon fiscal"
                          className="max-h-[460px] w-full object-contain"
                        />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {financialDocModal.kind === "factura" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {financialDocModal.data.invoice_date
                          ? new Date(financialDocModal.data.invoice_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Număr document</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{financialDocModal.data.document_number || "-"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Furnizor</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{financialDocModal.data.supplier || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Total fără TVA</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {Number(financialDocModal.data.total_without_vat || 0).toFixed(2)} lei
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Total cu TVA</p>
                      <p className="mt-1 text-sm font-bold text-purple-700">
                        {Number(financialDocModal.data.total_with_vat || 0).toFixed(2)} lei
                      </p>
                    </div>
                  </div>

                  {financialDocModal.data.notes && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Observații</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{financialDocModal.data.notes}</p>
                    </div>
                  )}

                  {financialDocModal.data.invoice_image_url && (
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-gray-400">Document atașat</p>
                      <a
                        href={financialDocModal.data.invoice_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-2xl border border-gray-200"
                      >
                        <img
                          src={financialDocModal.data.invoice_image_url}
                          alt="Factură"
                          className="max-h-[460px] w-full object-contain"
                        />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {financialDocModal.kind === "nedeductibila" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Data</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {financialDocModal.data.expense_date
                          ? new Date(financialDocModal.data.expense_date).toLocaleDateString("ro-RO")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Cost</p>
                      <p className="mt-1 text-sm font-bold text-orange-700">
                        {Number(financialDocModal.data.cost_ron || 0).toFixed(2)} lei
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Serviciu</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{financialDocModal.data.service_name || "-"}</p>
                  </div>

                  {financialDocModal.data.notes && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Observații</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{financialDocModal.data.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-[#FCFBF8] px-5 py-3">
              <button
                type="button"
                onClick={() => setFinancialDocModal(null)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCHIMBARE STATUS PROIECT */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-center text-lg font-bold text-gray-900">Schimbă statusul</h3>
              <p className="mt-1 text-center text-sm text-gray-500">
                {projects.find((p) => p.id === statusModal.projectId)?.name || ""}
              </p>

              <div className="mt-5 space-y-2">
                {[
                  { value: "in_asteptare", label: "În așteptare", classes: "bg-yellow-100 text-yellow-700 border-yellow-300 ring-yellow-200" },
                  { value: "in_lucru", label: "În lucru", classes: "bg-[#0196ff]/10 text-[#0196ff] border-[#0196ff]/30 ring-[#0196ff]/20" },
                  { value: "finalizat", label: "Finalizat", classes: "bg-green-100 text-green-700 border-green-300 ring-green-200" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPendingStatus(opt.value)}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
                      pendingStatus === opt.value
                        ? `${opt.classes} ring-2`
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {pendingStatus && pendingStatus !== statusModal.currentStatus && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">
                    Ești sigur că vrei să schimbi statusul în{" "}
                    <span className="font-bold">
                      {pendingStatus === "in_asteptare" ? "În așteptare" : pendingStatus === "in_lucru" ? "În lucru" : "Finalizat"}
                    </span>?
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  disabled={savingStatusId === statusModal.projectId || !pendingStatus || pendingStatus === statusModal.currentStatus}
                  className="flex-1 rounded-xl bg-[#0196ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingStatusId === statusModal.projectId ? "Se salvează..." : "Confirmă"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusModal(null); setPendingStatus(null); }}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMARE ȘTERGERE PROIECT */}
      {deleteProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#E8E5DE] bg-white shadow-2xl">
            <div className="p-6">
              <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-600" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h3 className="text-center text-lg font-bold text-gray-900">Ștergi acest proiect?</h3>
              <p className="mt-2 text-center text-sm text-gray-500">
                Acțiunea este ireversibilă. Se vor șterge definitiv toate datele asociate acestui proiect.
              </p>

              {(() => {
                const proj = projects.find((p) => p.id === deleteProjectId);
                return proj ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold text-red-800">{proj.name}</p>
                    <p className="mt-1 text-xs text-red-600">{proj.beneficiary || "-"}</p>
                    <div className="mt-2 space-y-0.5 text-xs text-red-500">
                      <p>· Echipe, bonuri, facturi, nedeductibile</p>
                      <p>· Comenzi, pontaje, ore extra, weekend</p>
                      <p>· Alimentări de card și cont</p>
                      <p>· Poze, devize, centru de cost</p>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Introdu parola de confirmare
                </label>
                <input
                  type="password"
                  value={deleteProjectPassword}
                  onChange={(e) => {
                    setDeleteProjectPassword(e.target.value);
                    setDeleteProjectPasswordError("");
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleDeleteProject(); }}
                  placeholder="Parolă de ștergere"
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                    deleteProjectPasswordError
                      ? "border-red-400 bg-red-50"
                      : "border-gray-300 focus:border-gray-500"
                  }`}
                />
                {deleteProjectPasswordError && (
                  <p className="mt-2 text-xs font-medium text-red-600">{deleteProjectPasswordError}</p>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={deletingProject || !deleteProjectPassword}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {deletingProject ? "Se șterge..." : "Confirmă ștergerea"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteProjectId(null);
                    setDeleteProjectPassword("");
                    setDeleteProjectPasswordError("");
                  }}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
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
            <p className="text-sm text-gray-500">{canManageProjects ? "Administrare proiecte" : "Proiectele mele"}</p>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {canManageProjects ? "Toate proiectele" : "Proiectele mele"}
            </h1>

            <p className="mt-2 text-sm text-gray-500">{profile?.full_name}</p>
          </div>

          <div className="mt-5">
            <input
              type="text"
              placeholder="Caută după nume sau beneficiar"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />
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
                const photoDates = projectPhotos
                  ? Array.from(projectPhotos.keys()).sort((a, b) => b.localeCompare(a))
                  : [];

                const projectReports = reportsByProject.get(project.id) || [];
                const isDevizOpen = devizProjectId === project.id;

                // Total cumulat pe proiect (admin only) — doar în tab Deviz
                const projectDevizTotal = projectReports.reduce(
                  (s, r) => s + (reportTotalById.get(r.id) || 0),
                  0
                );

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

                        <div className="flex flex-col items-end gap-2">
                          {canManageProjects ? (
                            <button
                              type="button"
                              onClick={() => { setStatusModal({ projectId: project.id, currentStatus: project.status }); setPendingStatus(project.status); }}
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 ${getStatusClasses(project.status)}`}
                            >
                              {getStatusLabel(project.status)}
                              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5">
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          ) : (
                            <span className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(project.status)}`}>
                              {getStatusLabel(project.status)}
                            </span>
                          )}
                          {canManageProjects && (
                            <button
                              type="button"
                              onClick={() => openDeleteProject(project.id)}
                              className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Șterge
                            </button>
                          )}
                        </div>
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

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Credit alimentat</p>
                          <p className="mt-1 text-sm font-bold text-blue-700">
                            {(fundingTotalsByProject.get(project.id) || 0).toFixed(2)} lei
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Credit cheltuit</p>
                          <p className="mt-1 text-sm font-bold text-orange-600">
                            {((fundingTotalsByProject.get(project.id) || 0) - currentCredit).toFixed(2)} lei
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

                        {!isAdminLimitat && (
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
                        )}
                      </div>

                      {projectTab === "financiar" && (
                        <div className="mt-4 flex flex-col gap-3">
                          {profile?.role === "sef_echipa" ? (
                            // SEF ECHIPA: doar butoane upload
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
                          ) : (profile?.role === "admin_limitat" || profile?.role === "project_manager") ? (
                            // ADMIN_LIMITAT / PROJECT_MANAGER: upload + istoric
                            (() => {
                              const allFinDocs = financialDocsByProject.get(project.id) || [];
                              const isExpanded = finExpand[project.id] || false;
                              const docsToRender = isExpanded ? allFinDocs : allFinDocs.slice(0, 3);
                              const hiddenCount = isExpanded ? 0 : Math.max(allFinDocs.length - 3, 0);
                              return (
                                <div className="space-y-3">
                                  {/* Sectiunea Incarca */}
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Încarcă documente</p>
                                      <div className="h-px flex-1 bg-[#E8E5DE]" />
                                    </div>
                                    <div className="space-y-2">
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
                                    </div>
                                  </div>
                                  {/* Sectiunea Istoric */}
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                                        Istoric ({allFinDocs.length})
                                      </p>
                                      <div className="h-px flex-1 bg-[#E8E5DE]" />
                                    </div>
                                    {allFinDocs.length === 0 ? (
                                      <div className="rounded-2xl bg-[#F8F7F3] px-4 py-3 text-center">
                                        <p className="text-sm text-gray-400">Nu există documente încărcate încă.</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {docsToRender.map((doc) => {
                                          const date = getFinDocDate(doc);
                                          const amount = getFinDocAmount(doc);
                                          const label = getFinDocLabel(doc);
                                          const badgeClasses = doc.kind === "bon" ? "bg-blue-100 text-blue-700" : doc.kind === "factura" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700";
                                          const borderClasses = doc.kind === "bon" ? "border-blue-100 hover:bg-blue-50/60" : doc.kind === "factura" ? "border-purple-100 hover:bg-purple-50/60" : "border-orange-100 hover:bg-orange-50/60";
                                          const bgClasses = doc.kind === "bon" ? "bg-blue-50/30" : doc.kind === "factura" ? "bg-purple-50/30" : "bg-orange-50/30";
                                          const detailText = doc.kind === "nedeductibila" ? label : `Nr. ${label}`;
                                          return (
                                            <button
                                              key={`${doc.kind}-${doc.data.id}`}
                                              type="button"
                                              onClick={() => setFinancialDocModal(doc)}
                                              className={`flex w-full items-center justify-between gap-3 rounded-2xl border ${borderClasses} ${bgClasses} px-3 py-2.5 text-left transition`}
                                            >
                                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${badgeClasses}`}>
                                                  {doc.kind === "bon" ? "B" : doc.kind === "factura" ? "F" : "N"}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate text-sm font-semibold text-gray-900">{detailText}</p>
                                                  <p className="text-xs text-gray-500">
                                                    {date ? new Date(date).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "fără dată"}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex shrink-0 items-center gap-1.5">
                                                <p className="text-sm font-bold text-gray-900">{amount.toFixed(2)} lei</p>
                                                <span className="text-gray-400">›</span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                        {hiddenCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setFinExpand((prev) => ({ ...prev, [project.id]: true }))}
                                            className="w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                          >
                                            Arată mai mult ({hiddenCount} {hiddenCount === 1 ? "document" : "documente"})
                                          </button>
                                        )}
                                        {isExpanded && allFinDocs.length > 3 && (
                                          <button
                                            type="button"
                                            onClick={() => setFinExpand((prev) => ({ ...prev, [project.id]: false }))}
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                                          >
                                            Arată mai puțin
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            (() => {
                              const allFinDocs = financialDocsByProject.get(project.id) || [];
                              const filterDate = finDateFilter[project.id] || "";
                              const isExpanded = finExpand[project.id] || false;

                              const visibleDocs = filterDate
                                ? allFinDocs.filter((d) => getFinDocDate(d) === filterDate)
                                : allFinDocs;

                              const docsToRender =
                                !filterDate && !isExpanded ? visibleDocs.slice(0, 3) : visibleDocs;
                              const hiddenCount = !filterDate && !isExpanded
                                ? Math.max(visibleDocs.length - 3, 0)
                                : 0;

                              if (allFinDocs.length === 0) {
                                return (
                                  <div className="rounded-2xl bg-[#F8F7F3] px-4 py-4 text-center">
                                    <p className="text-sm text-gray-400">
                                      Șeful de echipă nu a încărcat încă documente financiare pentru acest proiect.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-3">
                                  <div className="rounded-2xl border border-gray-200 bg-[#F8F7F3] p-3">
                                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                                      Caută după dată
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) =>
                                          setFinDateFilter((prev) => ({
                                            ...prev,
                                            [project.id]: e.target.value,
                                          }))
                                        }
                                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                      />
                                      {filterDate && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setFinDateFilter((prev) => ({
                                              ...prev,
                                              [project.id]: "",
                                            }))
                                          }
                                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="mb-1 flex items-center gap-3 px-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                                        {filterDate
                                          ? `Rezultate (${visibleDocs.length})`
                                          : `Istoric documente (${allFinDocs.length})`}
                                      </p>
                                      <div className="h-px flex-1 bg-[#E8E5DE]" />
                                    </div>

                                    {visibleDocs.length === 0 ? (
                                      <p className="text-sm text-gray-400">
                                        Nu există documente pentru data selectată.
                                      </p>
                                    ) : (
                                      <>
                                        {docsToRender.map((doc) => {
                                          const date = getFinDocDate(doc);
                                          const amount = getFinDocAmount(doc);
                                          const label = getFinDocLabel(doc);

                                          const badgeClasses =
                                            doc.kind === "bon"
                                              ? "bg-blue-100 text-blue-700"
                                              : doc.kind === "factura"
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-orange-100 text-orange-700";

                                          const borderClasses =
                                            doc.kind === "bon"
                                              ? "border-blue-100 hover:bg-blue-50/60"
                                              : doc.kind === "factura"
                                              ? "border-purple-100 hover:bg-purple-50/60"
                                              : "border-orange-100 hover:bg-orange-50/60";

                                          const bgClasses =
                                            doc.kind === "bon"
                                              ? "bg-blue-50/30"
                                              : doc.kind === "factura"
                                              ? "bg-purple-50/30"
                                              : "bg-orange-50/30";

                                          const labelText =
                                            doc.kind === "bon"
                                              ? "Bon"
                                              : doc.kind === "factura"
                                              ? "Factură"
                                              : "Nedeductibilă";

                                          const detailText =
                                            doc.kind === "nedeductibila" ? label : `Nr. ${label}`;

                                          return (
                                            <button
                                              key={`${doc.kind}-${doc.data.id}`}
                                              type="button"
                                              onClick={() => setFinancialDocModal(doc)}
                                              className={`flex w-full items-center justify-between gap-3 rounded-2xl border ${borderClasses} ${bgClasses} px-3 py-2.5 text-left transition`}
                                            >
                                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <span
                                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${badgeClasses}`}
                                                >
                                                  {doc.kind === "bon" ? "B" : doc.kind === "factura" ? "F" : "N"}
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate text-sm font-semibold text-gray-900">
                                                    {detailText}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    {date
                                                      ? new Date(date).toLocaleDateString("ro-RO", {
                                                          day: "numeric",
                                                          month: "short",
                                                          year: "numeric",
                                                        })
                                                      : "fără dată"}
                                                  </p>
                                                </div>
                                              </div>

                                              <div className="flex shrink-0 items-center gap-1.5">
                                                <p className="text-sm font-bold text-gray-900">
                                                  {amount.toFixed(2)} lei
                                                </p>
                                                <span className="text-gray-400">›</span>
                                              </div>
                                            </button>
                                          );
                                        })}

                                        {hiddenCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setFinExpand((prev) => ({
                                                ...prev,
                                                [project.id]: true,
                                              }))
                                            }
                                            className="w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                          >
                                            Arată mai mult ({hiddenCount} {hiddenCount === 1 ? "document" : "documente"})
                                          </button>
                                        )}

                                        {!filterDate && isExpanded && allFinDocs.length > 3 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setFinExpand((prev) => ({
                                                ...prev,
                                                [project.id]: false,
                                              }))
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                                          >
                                            Arată mai puțin
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
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

                          {/* TAB POZE — listă pe zile cu filter date + ultimele 3 + expand */}
                          {tehnicTab === "poze" && (() => {
                            const filterDate = photoDateFilter[project.id] || "";
                            const isExpanded = photoExpand[project.id] || false;

                            const visibleDates = filterDate
                              ? photoDates.filter((d) => d === filterDate)
                              : photoDates;

                            const datesToRender =
                              !filterDate && !isExpanded ? visibleDates.slice(0, 3) : visibleDates;
                            const hiddenCount = !filterDate && !isExpanded
                              ? Math.max(visibleDates.length - 3, 0)
                              : 0;

                            return (
                              <div className="mt-4 space-y-3">
                                {canAddPhotos && (
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
                                    {uploadingPhoto && photoProjectId === project.id
                                      ? "Se încarcă..."
                                      : `Adaugă poze (${getTodayDate()})`}
                                  </button>
                                )}

                                {photoDates.length > 0 && (
                                  <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
                                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                      Caută după dată
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) =>
                                          setPhotoDateFilter((prev) => ({
                                            ...prev,
                                            [project.id]: e.target.value,
                                          }))
                                        }
                                        className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                                      />
                                      {filterDate && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPhotoDateFilter((prev) => ({
                                              ...prev,
                                              [project.id]: "",
                                            }))
                                          }
                                          className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {photoDates.length > 0 ? (
                                  <div className="space-y-2">
                                    <div className="mb-1 flex items-center gap-3 px-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                                        {filterDate
                                          ? `Rezultate (${visibleDates.length})`
                                          : `Zile cu poze (${photoDates.length})`}
                                      </p>
                                      <div className="h-px flex-1 bg-[#E8E5DE]" />
                                    </div>

                                    {visibleDates.length === 0 ? (
                                      <p className="text-sm text-gray-400">Nu există poze pentru data selectată.</p>
                                    ) : (
                                      <>
                                        {datesToRender.map((date) => {
                                          const photos = projectPhotos!.get(date) || [];
                                          return (
                                            <button
                                              key={date}
                                              type="button"
                                              onClick={() =>
                                                setPhotosModal({
                                                  projectId: project.id,
                                                  date,
                                                  photos,
                                                })
                                              }
                                              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-left transition hover:bg-amber-50"
                                            >
                                              <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-amber-600" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="5" width="18" height="14" rx="2" />
                                                    <circle cx="9" cy="11" r="2" />
                                                    <path d="M3 17l5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
                                                  </svg>
                                                </div>
                                                <div>
                                                  <p className="text-sm font-semibold text-gray-900">
                                                    {new Date(date).toLocaleDateString("ro-RO", {
                                                      weekday: "short",
                                                      day: "numeric",
                                                      month: "short",
                                                      year: "numeric",
                                                    })}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    {photos.length} {photos.length === 1 ? "poză" : "poze"}
                                                  </p>
                                                </div>
                                              </div>
                                              <span className="text-amber-600">›</span>
                                            </button>
                                          );
                                        })}

                                        {hiddenCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPhotoExpand((prev) => ({
                                                ...prev,
                                                [project.id]: true,
                                              }))
                                            }
                                            className="w-full rounded-2xl border border-dashed border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                                          >
                                            Arată mai mult ({hiddenCount} {hiddenCount === 1 ? "zi" : "zile"})
                                          </button>
                                        )}

                                        {!filterDate && isExpanded && photoDates.length > 3 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPhotoExpand((prev) => ({
                                                ...prev,
                                                [project.id]: false,
                                              }))
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                                          >
                                            Arată mai puțin
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">
                                    {isAdmin
                                      ? "Nu există poze pentru acest proiect."
                                      : "Nu ai încărcat încă poze pentru acest proiect."}
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {/* TAB DEVIZ — total cumulat (admin) + listă pe zile, click → modal */}
                          {tehnicTab === "deviz" && (
                            <div className="mt-4 space-y-3">
                              {/* Total cumulat — doar admin */}
                              {canManageProjects && projectReports.length > 0 && (
                                <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                                        Total cumulat
                                      </p>
                                      <p className="mt-1 text-2xl font-extrabold text-teal-800">
                                        {projectDevizTotal.toFixed(2)} <span className="text-sm font-semibold">lei</span>
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                                        Devize
                                      </p>
                                      <p className="mt-1 text-2xl font-extrabold text-teal-800">{projectReports.length}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(() => {
                                const filterDate = devizDateFilter[project.id] || "";
                                const isExpanded = devizExpand[project.id] || false;

                                const visibleReports = filterDate
                                  ? projectReports.filter((r) => r.report_date === filterDate)
                                  : projectReports;

                                const reportsToRender =
                                  !filterDate && !isExpanded ? visibleReports.slice(0, 3) : visibleReports;
                                const hiddenCount = !filterDate && !isExpanded
                                  ? Math.max(visibleReports.length - 3, 0)
                                  : 0;

                                if (projectReports.length === 0) {
                                  return isAdmin ? (
                                    <p className="text-sm text-gray-400">
                                      Șeful de echipă nu a adăugat încă devize pentru acest proiect.
                                    </p>
                                  ) : null;
                                }

                                return (
                                  <>
                                    <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-3">
                                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                                        Caută după dată
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="date"
                                          value={filterDate}
                                          onChange={(e) =>
                                            setDevizDateFilter((prev) => ({
                                              ...prev,
                                              [project.id]: e.target.value,
                                            }))
                                          }
                                          className="flex-1 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                                        />
                                        {filterDate && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDevizDateFilter((prev) => ({
                                                ...prev,
                                                [project.id]: "",
                                              }))
                                            }
                                            className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                                          >
                                            Reset
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="mb-1 flex items-center gap-3 px-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                                          {filterDate
                                            ? `Rezultate (${visibleReports.length})`
                                            : `Zile cu deviz (${projectReports.length})`}
                                        </p>
                                        <div className="h-px flex-1 bg-[#E8E5DE]" />
                                      </div>

                                      {visibleReports.length === 0 ? (
                                        <p className="text-sm text-gray-400">
                                          Nu există deviz pentru data selectată.
                                        </p>
                                      ) : (
                                        <>
                                          {reportsToRender.map((report) => {
                                            const itemsCount = dailyReportItems.filter(
                                              (i) => i.daily_report_id === report.id
                                            ).length;
                                            const dayTotal = reportTotalById.get(report.id) || 0;

                                            return (
                                              <button
                                                key={report.id}
                                                type="button"
                                                onClick={() =>
                                                  setDevizModal({
                                                    projectId: project.id,
                                                    projectName: project.name,
                                                    date: report.report_date,
                                                    reportId: report.id,
                                                  })
                                                }
                                                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50/40 px-4 py-3 text-left transition hover:bg-teal-50"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100">
                                                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-teal-600" stroke="currentColor" strokeWidth="2">
                                                      <rect x="4" y="3" width="16" height="18" rx="2" />
                                                      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
                                                    </svg>
                                                  </div>
                                                  <div>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                      {new Date(report.report_date).toLocaleDateString("ro-RO", {
                                                        weekday: "short",
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                      })}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{itemsCount} servicii</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {canManageProjects && (
                                                    <p className="text-sm font-bold text-teal-700">{dayTotal.toFixed(2)} lei</p>
                                                  )}
                                                  <span className="text-teal-600">›</span>
                                                </div>
                                              </button>
                                            );
                                          })}

                                          {hiddenCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDevizExpand((prev) => ({
                                                  ...prev,
                                                  [project.id]: true,
                                                }))
                                              }
                                              className="w-full rounded-2xl border border-dashed border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                                            >
                                              Arată mai mult ({hiddenCount} {hiddenCount === 1 ? "deviz" : "devize"})
                                            </button>
                                          )}

                                          {!filterDate && isExpanded && projectReports.length > 3 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDevizExpand((prev) => ({
                                                  ...prev,
                                                  [project.id]: false,
                                                }))
                                              }
                                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                                            >
                                              Arată mai puțin
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}

                              {/* Form creare deviz — doar șef echipă */}
                              {canCreateDeviz && isDevizOpen && (
                                <div className="rounded-2xl border border-teal-200 bg-teal-50 p-3 sm:p-4">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-teal-900">
                                        Deviz — {new Date(devizDate).toLocaleDateString("ro-RO")}
                                      </p>
                                      <p className="text-[11px] text-teal-700">Adaugă serviciile efectuate</p>
                                    </div>

                                    <input
                                      type="date"
                                      value={devizDate}
                                      onChange={(e) => openDeviz(project.id, e.target.value)}
                                      className="shrink-0 rounded-lg border border-teal-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500"
                                    />
                                  </div>

                                  {/* CARDURI ARTICOLE — PICKER MODAL */}
                                  <div className="space-y-2">
                                    {devizItems.map((line, index) => {
                                      const selectedSvc = services.find((s) => s.id === line.service_id);
                                      const lineValid = isDevizLineValid(line);
                                      const showError = showDevizValidation && !lineValid;
                                      const missingService = !line.service_id;
                                      const missingQty = !(Number(line.quantity || 0) > 0);

                                      return (
                                        <div key={index}
                                          className={`rounded-xl border bg-white p-2.5 transition ${showError ? "border-red-300 ring-1 ring-red-200" : "border-teal-200"}`}>
                                          <div className="mb-1.5 flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">#{index + 1}</p>
                                            {devizItems.length > 1 && (
                                              <button type="button" onClick={() => removeDevizLine(index)}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm text-red-600 hover:bg-red-100">
                                                ×
                                              </button>
                                            )}
                                          </div>

                                          {/* Buton selector serviciu — deschide picker */}
                                          <button type="button"
                                            onClick={() => { setServicePickerLine(index); setServicePickerSearch(""); }}
                                            className={`mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                                              showError && missingService ? "border-red-300 bg-red-50" : selectedSvc ? "border-teal-300 bg-teal-50/50" : "border-gray-200 bg-[#F8F7F3]"
                                            }`}>
                                            <span className={`min-w-0 flex-1 truncate ${selectedSvc ? "font-medium text-teal-800" : "text-gray-400"}`}>
                                              {selectedSvc ? selectedSvc.name : "Alege serviciu..."}
                                            </span>
                                            {selectedSvc
                                              ? <span className="shrink-0 rounded-md bg-teal-100 px-1.5 py-0.5 text-xs font-semibold text-teal-700">{selectedSvc.um}</span>
                                              : <span className="shrink-0 text-gray-400 text-xs">›</span>
                                            }
                                          </button>

                                          {/* Cantitate */}
                                          <div className="flex items-center gap-2">
                                            <input type="number" inputMode="decimal" min="0" step="0.01"
                                              value={line.quantity}
                                              onChange={(e) => updateDevizLine(index, "quantity", e.target.value)}
                                              placeholder="Cantitate *"
                                              className={`w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-teal-500 ${
                                                showError && missingQty ? "border-red-300 bg-red-50" : "border-gray-200"
                                              }`} />
                                            {selectedSvc && (
                                              <span className="shrink-0 rounded-md bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">{selectedSvc.um}</span>
                                            )}
                                          </div>

                                          {showError && (
                                            <p className="mt-1.5 text-[11px] font-medium text-red-600">
                                              {missingService && missingQty ? "Selectează serviciu și introdu cantitatea."
                                                : missingService ? "Selectează un serviciu."
                                                : "Introdu o cantitate mai mare ca 0."}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={addDevizLine}
                                    className="mt-2 w-full rounded-xl border border-dashed border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                                  >
                                    + Adaugă serviciu
                                  </button>

                                  {showDevizValidation && !isDevizFullyValid && (
                                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                                      <p className="text-xs font-medium text-red-700">
                                        Toate rândurile trebuie să aibă serviciu selectat și cantitate &gt; 0.
                                      </p>
                                    </div>
                                  )}

                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <button
                                      type="button"
                                      onClick={handleSaveDeviz}
                                      disabled={savingDeviz || !isDevizFullyValid}
                                      className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {savingDeviz ? "Se salvează..." : "Salvează devizul"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDevizProjectId(null);
                                        setServiceSearchByLine({});
                                        setShowDevizValidation(false);
                                      }}
                                      className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                                    >
                                      Închide
                                    </button>
                                  </div>
                                </div>
                              )}

                              {canCreateDeviz && !isDevizOpen && (
                                <button
                                  type="button"
                                  onClick={() => openDeviz(project.id)}
                                  className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                  {projectReports.length === 0 ? "+ Creează deviz pentru azi" : "+ Deviz nou pentru azi"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* FORMULAR BON / FACTURĂ */}
                    {(profile?.role === "sef_echipa" || profile?.role === "project_manager" || profile?.role === "admin_limitat") && activeInlineProjectId === project.id && projectTab === "financiar" && (
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

                        {/* BANNER DUPLICAT */}
                        {duplicateWarning && (
                          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">!</span>
                            <div>
                              <p className="text-sm font-bold text-red-700">Document duplicat detectat</p>
                              <p className="mt-0.5 text-xs text-red-600">{duplicateWarning}</p>
                              <p className="mt-1 text-xs text-red-500">Modifică numărul documentului sau data pentru a putea salva.</p>
                            </div>
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
                                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                                  duplicateWarning
                                    ? "border-red-400 bg-red-50 focus:border-red-500"
                                    : "border-gray-200 focus:border-gray-500"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Număr document</label>
                              <input
                                type="text"
                                value={formState.documentNumber}
                                onChange={(e) => updateFormField("documentNumber", e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                                  duplicateWarning
                                    ? "border-red-400 bg-red-50 focus:border-red-500"
                                    : "border-gray-200 focus:border-gray-500"
                                }`}
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
                            disabled={savingInline || uploadingImage || isExtracting || !!duplicateWarning}
                            className="w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* PICKER SERVICIU — MODAL BOTTOM SHEET */}
      {servicePickerLine !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => { setServicePickerLine(null); setServicePickerSearch(""); }}>
          <div className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[75vh] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <p className="text-base font-bold text-gray-900">Alege serviciu</p>
              <button type="button"
                onClick={() => { setServicePickerLine(null); setServicePickerSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 hover:bg-gray-200">
                ✕
              </button>
            </div>
            <div className="px-4 pb-2">
              <input autoFocus value={servicePickerSearch}
                onChange={(e) => setServicePickerSearch(e.target.value)}
                placeholder="Caută serviciu..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-teal-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {(() => {
                const filtered = services
                  .filter((s) => !servicePickerSearch.trim() || s.name.toLowerCase().includes(servicePickerSearch.toLowerCase()))
                  .slice(0, 50);
                if (filtered.length === 0) return (
                  <p className="py-6 text-center text-sm text-gray-400">Niciun serviciu găsit.</p>
                );
                return (
                  <div className="space-y-1">
                    {filtered.map((svc) => {
                      const isSelected = servicePickerLine !== null && devizItems[servicePickerLine]?.service_id === svc.id;
                      return (
                        <button key={svc.id} type="button"
                          onClick={() => {
                            if (servicePickerLine !== null) {
                              updateDevizLine(servicePickerLine, "service_id", svc.id);
                            }
                            setServicePickerLine(null);
                            setServicePickerSearch("");
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${
                            isSelected ? "bg-teal-600 text-white" : "hover:bg-teal-50"
                          }`}>
                          <span className={`min-w-0 flex-1 truncate text-sm font-medium leading-snug ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {svc.name}
                          </span>
                          <span className={`shrink-0 text-xs ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                            {svc.um} · {Number(svc.price_ron).toFixed(2)} lei
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
