"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
  beneficiary: string | null;
  status: string | null;
  created_at: string;
};

type ProjectFunding = {
  project_id: string;
  amount_ron: number | null;
};

type FiscalReceipt = {
  project_id: string;
  total_with_vat: number | null;
};

type ProjectInvoice = {
  project_id: string;
  total_with_vat: number | null;
};

type NondeductibleExpense = {
  project_id: string;
  cost_ron: number | null;
};

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
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-4 w-4"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 16V4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9L12 4L17 9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20H20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProiectePage() {
  const router = useRouter();

  const bonInputRef = useRef<HTMLInputElement | null>(null);
  const facturaInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const [fundings, setFundings] = useState<ProjectFunding[]>([]);
  const [receipts, setReceipts] = useState<FiscalReceipt[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [nondeductibles, setNondeductibles] = useState<NondeductibleExpense[]>(
    []
  );

  const [searchName, setSearchName] = useState("");
  const [selectedYear, setSelectedYear] = useState("toate");
  const [selectedMonth, setSelectedMonth] = useState("toate");

  const [activeInlineProjectId, setActiveInlineProjectId] = useState<string | null>(null);
  const [activeInlineType, setActiveInlineType] = useState<UploadDocType | null>(null);

  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [formState, setFormState] = useState<InlineFormState>(createEmptyForm());

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [savingInline, setSavingInline] = useState(false);

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

      let visibleProjects: Project[] = [];

      if (profileData.role === "administrator") {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, status, created_at")
          .order("created_at", { ascending: true });

        if (!projectsError && projectsData) {
          visibleProjects = projectsData as Project[];
          setProjects(visibleProjects);
        }
      }

      if (profileData.role === "sef_echipa") {
        const { data: linkedProjects, error: linkedProjectsError } =
          await supabase
            .from("project_team_leads")
            .select("project_id")
            .eq("user_id", user.id);

        if (linkedProjectsError || !linkedProjects) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const projectIds = linkedProjects.map((item) => item.project_id);

        if (projectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, beneficiary, status, created_at")
          .in("id", projectIds)
          .order("created_at", { ascending: true });

        if (!projectsError && projectsData) {
          visibleProjects = projectsData as Project[];
          setProjects(visibleProjects);
        }
      }

      const projectIds = visibleProjects.map((project) => project.id);

      if (projectIds.length > 0) {
        const [
          fundingsRes,
          receiptsRes,
          invoicesRes,
          nondeductiblesRes,
        ] = await Promise.all([
          supabase
            .from("project_fundings")
            .select("project_id, amount_ron")
            .in("project_id", projectIds),

          supabase
            .from("fiscal_receipts")
            .select("project_id, total_with_vat")
            .in("project_id", projectIds),

          supabase
            .from("project_invoices")
            .select("project_id, total_with_vat")
            .in("project_id", projectIds),

          supabase
            .from("project_nondeductible_expenses")
            .select("project_id, cost_ron")
            .in("project_id", projectIds),
        ]);

        setFundings((fundingsRes.data as ProjectFunding[]) || []);
        setReceipts((receiptsRes.data as FiscalReceipt[]) || []);
        setInvoices((invoicesRes.data as ProjectInvoice[]) || []);
        setNondeductibles(
          (nondeductiblesRes.data as NondeductibleExpense[]) || []
        );
      } else {
        setFundings([]);
        setReceipts([]);
        setInvoices([]);
        setNondeductibles([]);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const availableYears = useMemo(() => {
    const years = projects.map((project) =>
      new Date(project.created_at).getFullYear().toString()
    );

    return [
      "toate",
      ...Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a)),
    ];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const projectDate = new Date(project.created_at);
      const projectYear = projectDate.getFullYear().toString();
      const projectMonth = (projectDate.getMonth() + 1).toString();

      const q = searchName.toLowerCase();

      const matchesName =
        project.name.toLowerCase().includes(q) ||
        (project.beneficiary || "").toLowerCase().includes(q);

      const matchesYear =
        selectedYear === "toate" || projectYear === selectedYear;

      const matchesMonth =
        selectedMonth === "toate" || projectMonth === selectedMonth;

      return matchesName && matchesYear && matchesMonth;
    });
  }, [projects, searchName, selectedYear, selectedMonth]);

  const fundingTotalsByProject = useMemo(() => {
    const map = new Map<string, number>();

    fundings.forEach((row) => {
      const current = map.get(row.project_id) || 0;
      map.set(row.project_id, current + Number(row.amount_ron || 0));
    });

    return map;
  }, [fundings]);

  const receiptTotalsByProject = useMemo(() => {
    const map = new Map<string, number>();

    receipts.forEach((row) => {
      const current = map.get(row.project_id) || 0;
      map.set(row.project_id, current + Number(row.total_with_vat || 0));
    });

    return map;
  }, [receipts]);

  const invoiceTotalsByProject = useMemo(() => {
    const map = new Map<string, number>();

    invoices.forEach((row) => {
      const current = map.get(row.project_id) || 0;
      map.set(row.project_id, current + Number(row.total_with_vat || 0));
    });

    return map;
  }, [invoices]);

  const nondeductibleTotalsByProject = useMemo(() => {
    const map = new Map<string, number>();

    nondeductibles.forEach((row) => {
      const current = map.get(row.project_id) || 0;
      map.set(row.project_id, current + Number(row.cost_ron || 0));
    });

    return map;
  }, [nondeductibles]);

  const currentCreditByProject = useMemo(() => {
    const map = new Map<string, number>();

    projects.forEach((project) => {
      const totalFunded = fundingTotalsByProject.get(project.id) || 0;
      const totalReceipts = receiptTotalsByProject.get(project.id) || 0;
      const totalInvoices = invoiceTotalsByProject.get(project.id) || 0;
      const totalNondeductibles =
        nondeductibleTotalsByProject.get(project.id) || 0;

      const currentCredit =
        totalFunded - totalReceipts - totalInvoices - totalNondeductibles;

      map.set(project.id, currentCredit);
    });

    return map;
  }, [
    projects,
    fundingTotalsByProject,
    receiptTotalsByProject,
    invoiceTotalsByProject,
    nondeductibleTotalsByProject,
  ]);

  const getStatusLabel = (status: string | null) => {
    if (status === "in_asteptare") return "În așteptare";
    if (status === "in_lucru") return "În lucru";
    if (status === "finalizat") return "Finalizat";
    return "-";
  };

  const getStatusClasses = (status: string | null) => {
    if (status === "in_asteptare") {
      return "bg-yellow-100 text-yellow-700";
    }
    if (status === "in_lucru") {
      return "bg-[#0196ff]/10 text-[#0196ff]";
    }
    if (status === "finalizat") {
      return "bg-green-100 text-green-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  const renderProjectIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6 text-blue-600 sm:h-7 sm:w-7"
    >
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="4"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="10"
        width="7"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
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
      return;
    }

    facturaInputRef.current?.click();
  };

  const applyExtractedData = (data: any) => {
    setFormState({
      documentDate: data.document_date || "",
      supplier: data.supplier || "",
      documentNumber: data.document_number || "",
      totalWithoutVat:
        data.total_without_vat !== undefined && data.total_without_vat !== null
          ? String(data.total_without_vat)
          : "",
      totalWithVat:
        data.total_with_vat !== undefined && data.total_with_vat !== null
          ? String(data.total_with_vat)
          : "",
      notes: data.notes || "",
      items:
        Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((item: any) => ({
              item_name: item.item_name || "",
              quantity:
                item.quantity !== undefined && item.quantity !== null
                  ? String(item.quantity)
                  : "",
              unit_price:
                item.unit_price !== undefined && item.unit_price !== null
                  ? String(item.unit_price)
                  : "",
              line_total:
                item.line_total !== undefined && item.line_total !== null
                  ? String(item.line_total)
                  : "",
            }))
          : [createEmptyItem()],
    });
  };

  const uploadImageToStorage = async (
    file: File,
    projectId: string,
    type: UploadDocType
  ) => {
    setUploadingImage(true);

    const bucket = type === "bon" ? "bonuri-fiscale" : "facturi";
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${projectId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        upsert: false,
      });

    if (uploadError) {
      setUploadingImage(false);
      alert(`Eroare la încărcarea imaginii: ${uploadError.message}`);
      return "";
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    setUploadedImageUrl(publicUrl);
    setUploadingImage(false);

    return publicUrl;
  };

  const handleCapturedDocument = async (
    e: ChangeEvent<HTMLInputElement>,
    type: UploadDocType
  ) => {
    const file = e.target.files?.[0] || null;
    const projectId = activeInlineProjectId;

    if (!file || !projectId) return;

    setExtractionError("");
    setImagePreview(URL.createObjectURL(file));

    const publicUrl = await uploadImageToStorage(file, projectId, type);
    if (!publicUrl) return;

    setIsExtracting(true);

    try {
      const endpoint =
        type === "bon" ? "/api/extract-receipt" : "/api/extract-invoice";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      const parsed = await res.json();

      if (!res.ok) {
        setExtractionError(parsed.error || "Nu s-au putut extrage datele.");
        setIsExtracting(false);
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
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateItem = (index: number, field: keyof InlineItem, value: string) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
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
      items:
        prev.items.length === 1
          ? prev.items
          : prev.items.filter((_, i) => i !== index),
    }));
  };

  const computedItemsTotal = useMemo(() => {
    return formState.items.reduce((sum, item) => {
      return sum + Number(item.line_total || 0);
    }, 0);
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
      alert(
        activeInlineType === "bon"
          ? "Completează data bonului."
          : "Completează data facturii."
      );
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

    const validItems = formState.items.filter(
      (item) =>
        item.item_name.trim() ||
        Number(item.quantity || 0) > 0 ||
        Number(item.unit_price || 0) > 0 ||
        Number(item.line_total || 0) > 0
    );

    if (validItems.length === 0) {
      alert("Adaugă cel puțin un material.");
      return;
    }

    setSavingInline(true);

    if (activeInlineType === "bon") {
      const { data: receiptData, error: receiptError } = await supabase
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

      if (receiptError || !receiptData) {
        alert(`Eroare la salvarea bonului: ${receiptError?.message || ""}`);
        setSavingInline(false);
        return;
      }

      const itemRows = validItems.map((item) => ({
        receipt_id: receiptData.id,
        item_name: item.item_name.trim(),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
      }));

      const { error: itemsError } = await supabase
        .from("fiscal_receipt_items")
        .insert(itemRows);

      if (itemsError) {
        alert(`Eroare la salvarea materialelor: ${itemsError.message}`);
        setSavingInline(false);
        return;
      }
    }

    if (activeInlineType === "factura") {
      const { data: invoiceData, error: invoiceError } = await supabase
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

      if (invoiceError || !invoiceData) {
        alert(`Eroare la salvarea facturii: ${invoiceError?.message || ""}`);
        setSavingInline(false);
        return;
      }

      const itemRows = validItems.map((item) => ({
        invoice_id: invoiceData.id,
        item_name: item.item_name.trim(),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
      }));

      const { error: itemsError } = await supabase
        .from("project_invoice_items")
        .insert(itemRows);

      if (itemsError) {
        alert(`Eroare la salvarea materialelor: ${itemsError.message}`);
        setSavingInline(false);
        return;
      }
    }

    alert(
      activeInlineType === "bon"
        ? "Bonul fiscal a fost salvat."
        : "Factura a fost salvată."
    );

    setSavingInline(false);
    setActiveInlineProjectId(null);
    setActiveInlineType(null);
    setImagePreview("");
    setUploadedImageUrl("");
    setExtractionError("");
    setFormState(createEmptyForm());

    const projectIds = projects.map((project) => project.id);

    if (projectIds.length > 0) {
      const [receiptsRes, invoicesRes, nondeductiblesRes] = await Promise.all([
        supabase
          .from("fiscal_receipts")
          .select("project_id, total_with_vat")
          .in("project_id", projectIds),

        supabase
          .from("project_invoices")
          .select("project_id, total_with_vat")
          .in("project_id", projectIds),

        supabase
          .from("project_nondeductible_expenses")
          .select("project_id, cost_ron")
          .in("project_id", projectIds),
      ]);

      setReceipts((receiptsRes.data as FiscalReceipt[]) || []);
      setInvoices((invoicesRes.data as ProjectInvoice[]) || []);
      setNondeductibles(
        (nondeductiblesRes.data as NondeductibleExpense[]) || []
      );
    }
  };

  if (loading) {
    return <div className="p-6">Se încarcă proiectele...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
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
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Înapoi la dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {profile?.role === "administrator"
                  ? "Administrare proiecte"
                  : "Proiectele tale"}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                {profile?.role === "administrator"
                  ? "Toate proiectele"
                  : "Proiectele mele"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-gray-500 sm:text-base">
                {profile?.full_name}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="text"
              placeholder="Caută după nume proiect sau beneficiar"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            />

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year === "toate" ? "Toți anii" : year}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Lista proiecte
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există proiecte pentru filtrele selectate.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const currentCredit = currentCreditByProject.get(project.id) || 0;
                const isActiveInline = activeInlineProjectId === project.id;

                return (
                  <div
                    key={project.id}
                    className="overflow-hidden rounded-[22px] border border-[#E8E5DE] bg-white shadow-sm"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-blue-50">
                              {renderProjectIcon()}
                            </div>

                            <div className="min-w-0">
                              <p className="text-[15px] font-bold leading-5 text-gray-900 sm:text-xl">
                                {project.name}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                {project.beneficiary || "-"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            project.status
                          )}`}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                            Data creare
                          </p>
                          <p className="mt-1 text-sm text-gray-700">
                            {new Date(project.created_at).toLocaleDateString("ro-RO")}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                            Credit curent
                          </p>
                          <p
                            className={`mt-1 text-sm font-semibold ${
                              currentCredit >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {currentCredit.toFixed(2)} lei
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => openCameraFor(project.id, "bon")}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#eef6ff] px-4 py-3 text-center text-sm font-semibold text-[#1976d2] transition hover:bg-[#e3f0ff]"
                        >
                          <UploadIcon />
                          Încarcă Bon
                        </button>

                        <button
                          type="button"
                          onClick={() => openCameraFor(project.id, "factura")}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 px-4 py-3 text-center text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                        >
                          <UploadIcon />
                          Încarcă Factură
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/proiecte/${project.id}/adauga-nedeductibile`
                            )
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-center text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                        >
                          <UploadIcon />
                          Adaugă Nedeductibilă
                        </button>
                      </div>
                    </div>

                    {isActiveInline && (
                      <div className="border-t border-[#E8E5DE] bg-[#FCFBF8] p-4 sm:p-5">
                        <div className="mb-4">
                          <p className="text-base font-semibold text-gray-900">
                            {activeInlineType === "bon"
                              ? "Card bon fiscal extras"
                              : "Card factură extrasă"}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            Fotografia este analizată automat, iar datele pot fi corectate înainte de salvare.
                          </p>
                        </div>

                        {imagePreview && (
                          <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                            <img
                              src={imagePreview}
                              alt="Preview document"
                              className="max-h-[420px] w-full rounded-xl object-contain"
                            />
                          </div>
                        )}

                        {uploadingImage && (
                          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                            <p className="text-sm font-medium text-blue-800">
                              Se încarcă imaginea...
                            </p>
                          </div>
                        )}

                        {isExtracting && (
                          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
                            <p className="text-sm font-medium text-purple-800">
                              AI analizează documentul și completează automat datele...
                            </p>
                          </div>
                        )}

                        {extractionError && (
                          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-sm font-medium text-red-700">
                              {extractionError}
                            </p>
                          </div>
                        )}

                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Data
                              </label>
                              <input
                                type="date"
                                value={formState.documentDate}
                                onChange={(e) =>
                                  updateFormField("documentDate", e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Număr document
                              </label>
                              <input
                                type="text"
                                value={formState.documentNumber}
                                onChange={(e) =>
                                  updateFormField("documentNumber", e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Furnizor
                              </label>
                              <input
                                type="text"
                                value={formState.supplier}
                                onChange={(e) =>
                                  updateFormField("supplier", e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Total fără TVA
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formState.totalWithoutVat}
                                onChange={(e) =>
                                  updateFormField("totalWithoutVat", e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Total cu TVA
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formState.totalWithVat}
                                onChange={(e) =>
                                  updateFormField("totalWithVat", e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Observații
                              </label>
                              <textarea
                                value={formState.notes}
                                onChange={(e) =>
                                  updateFormField("notes", e.target.value)
                                }
                                rows={3}
                                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-gray-900">
                              Materiale extrase
                            </h3>

                            <button
                              type="button"
                              onClick={addItem}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                                activeInlineType === "bon"
                                  ? "bg-[#0196ff]"
                                  : "bg-purple-600"
                              }`}
                            >
                              + Adaugă material
                            </button>
                          </div>

                          <div className="space-y-4">
                            {formState.items.map((item, index) => (
                              <div
                                key={index}
                                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-800">
                                    Material {index + 1}
                                  </p>

                                  {formState.items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeItem(index)}
                                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Șterge
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                  <div className="md:col-span-4">
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                      Denumire material
                                    </label>
                                    <input
                                      type="text"
                                      value={item.item_name}
                                      onChange={(e) =>
                                        updateItem(index, "item_name", e.target.value)
                                      }
                                      className="w-full rounded-xl border border-gray-300 px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                      Cantitate
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateItem(index, "quantity", e.target.value)
                                      }
                                      className="w-full rounded-xl border border-gray-300 px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                      Preț unitar
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) =>
                                        updateItem(index, "unit_price", e.target.value)
                                      }
                                      className="w-full rounded-xl border border-gray-300 px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                      Total linie
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.line_total}
                                      onChange={(e) =>
                                        updateItem(index, "line_total", e.target.value)
                                      }
                                      className="w-full rounded-xl border border-gray-300 px-4 py-3"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div
                            className={`mt-4 rounded-xl px-4 py-3 ${
                              activeInlineType === "bon"
                                ? "border border-blue-200 bg-blue-50"
                                : "border border-purple-200 bg-purple-50"
                            }`}
                          >
                            <p
                              className={`text-sm font-medium ${
                                activeInlineType === "bon"
                                  ? "text-blue-800"
                                  : "text-purple-800"
                              }`}
                            >
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
                            {savingInline
                              ? "Se salvează..."
                              : activeInlineType === "bon"
                              ? "Salvează Bon"
                              : "Salvează Factură"}
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