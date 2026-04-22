"use client";

import { useEffect, useMemo, useState } from "react";
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

type ProjectSectionTab = "financiara" | "tehnica";

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

export default function ProiectePage() {
  const router = useRouter();

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

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [activeSectionTab, setActiveSectionTab] =
    useState<ProjectSectionTab>("financiara");

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

      const matchesName = project.name
        .toLowerCase()
        .includes(searchName.toLowerCase());

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
    if (status === "in_asteptare") return "In asteptare";
    if (status === "in_lucru") return "In lucru";
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

  const openProjectModal = (project: Project) => {
    setSelectedProject(project);
    setActiveSectionTab("financiara");
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setSelectedProject(null);
    setActiveSectionTab("financiara");
  };

  if (loading) {
    return <div className="p-6">Se încarcă proiectele...</div>;
  }

  const selectedProjectCredit = selectedProject
    ? currentCreditByProject.get(selectedProject.id) || 0
    : 0;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {profile?.role === "administrator"
              ? "Toate proiectele"
              : "Proiectele mele"}
          </h1>
          <p className="text-sm text-gray-600">{profile?.full_name}</p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Înapoi la dashboard
        </button>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow">
        <div className="mb-3">
          <button
            type="button"
            className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
          >
            {profile?.role === "administrator"
              ? "Toate proiectele"
              : "Proiectele mele"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Caută după nume proiect"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="rounded-lg border px-4 py-3"
          />

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border px-4 py-3"
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
            className="rounded-lg border px-4 py-3"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow">
        <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
          <div className="col-span-2 md:col-span-1">Nr.</div>
          <div className="col-span-5 md:col-span-4">Nume proiect</div>
          <div className="col-span-5 md:col-span-4">Beneficiar</div>
          <div className="hidden md:block md:col-span-2">Status</div>
          <div className="hidden md:block md:col-span-1">Data</div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            Nu există proiecte pentru filtrele selectate.
          </div>
        ) : (
          filteredProjects.map((project, index) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProjectModal(project)}
              className="grid w-full grid-cols-12 border-b px-4 py-3 text-left text-sm transition hover:bg-gray-50 last:border-b-0"
            >
              <div className="col-span-2 md:col-span-1 font-semibold">
                {index + 1}
              </div>

              <div className="col-span-5 md:col-span-4">{project.name}</div>

              <div className="col-span-5 md:col-span-4">
                {project.beneficiary || "-"}
              </div>

              <div className="hidden md:block md:col-span-2">
                {getStatusLabel(project.status)}
              </div>

              <div className="hidden md:block md:col-span-1">
                {new Date(project.created_at).toLocaleDateString("ro-RO")}
              </div>
            </button>
          ))
        )}
      </div>

      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedProject.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedProject.beneficiary || "-"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                  selectedProject.status
                )}`}
              >
                {getStatusLabel(selectedProject.status)}
              </span>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveSectionTab("financiara")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeSectionTab === "financiara"
                    ? "bg-[#0196ff] text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Secțiune Financiară
              </button>

              <button
                type="button"
                onClick={() => setActiveSectionTab("tehnica")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeSectionTab === "tehnica"
                    ? "bg-[#0196ff] text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Secțiune Tehnică
              </button>
            </div>

            {activeSectionTab === "financiara" && (
              <div className="space-y-3">

                <div
                  className={`rounded-xl px-4 py-3 ${
                    selectedProjectCredit >= 0
                      ? "border border-green-200 bg-green-50"
                      : "border border-red-200 bg-red-50"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      selectedProjectCredit >= 0
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    Credit curent:
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold ${
                      selectedProjectCredit >= 0
                        ? "text-green-900"
                        : "text-red-900"
                    }`}
                  >
                    {selectedProjectCredit.toFixed(2)} lei
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      selectedProjectCredit >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    Credit alimentat minus bonuri, facturi și nedeductibile.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/proiecte/${selectedProject.id}/incarca-bf`)
                  }
                  className="w-full rounded-xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Încarcă BF
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/proiecte/${selectedProject.id}/incarca-factura`)
                  }
                  className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Încarcă Facturi
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/proiecte/${selectedProject.id}/adauga-nedeductibile`)
                  }
                  className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Adaugă Nedeductibile
                </button>
              </div>
            )}

            {activeSectionTab === "tehnica" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-800">
                    Secțiunea tehnică este pregătită.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Aici putem adăuga ulterior documente tehnice, montaj,
                    observații, schițe, procese sau alte opțiuni.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push(`/proiecte/${selectedProject.id}`)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Deschide proiect
              </button>

              <button
                type="button"
                onClick={closeProjectModal}
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}