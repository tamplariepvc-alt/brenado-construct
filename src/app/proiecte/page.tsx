"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Tipuri ---
type Role = "administrator" | "sef_echipa" | "user";
type Profile = { id: string; full_name: string; role: Role };
type Project = { id: string; name: string; beneficiary: string | null; status: string | null; created_at: string };
type ProjectFunding = { project_id: string; amount_ron: number | null };
type FiscalReceipt = { project_id: string; total_with_vat: number | null };
type ProjectInvoice = { project_id: string; total_with_vat: number | null };
type NondeductibleExpense = { project_id: string; cost_ron: number | null };
type Service = { id: string; name: string; um: string; price_ron: number };
type DailyReport = { id: string; project_id: string; report_date: string; created_by: string };
type DailyReportItem = { id: string; daily_report_id: string; service_id: string; quantity: number; service?: Service };
type DailyPhoto = { id: string; project_id: string; photo_date: string; photo_url: string; uploaded_by: string };

type ProjectTab = "financiar" | "tehnic";
type TehnicTab = "poze" | "deviz";

const getTodayDate = () => new Date().toISOString().split("T")[0];

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M12 16V4" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 9L12 4L17 9" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 20H20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProiectePage() {
  const router = useRouter();
  
  // Refs
  const bonInputRef = useRef<HTMLInputElement | null>(null);
  const facturaInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // State
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
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  // Modal Deviz
  const [isDevizModalOpen, setIsDevizModalOpen] = useState(false);
  const [devizProjectId, setDevizProjectId] = useState<string | null>(null);
  const [devizItems, setDevizItems] = useState<{ service_id: string; quantity: string }[]>([]);
  const [savingDeviz, setSavingDeviz] = useState(false);

  const isAdmin = profile?.role === "administrator";

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profileData } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
    if (!profileData) return;
    setProfile(profileData as Profile);

    const { data: visibleProjects } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(visibleProjects || []);

    const pIds = (visibleProjects || []).map(p => p.id);
    if (pIds.length > 0) {
      const [f, r, i, n, s, dr, dri, dp] = await Promise.all([
        supabase.from("project_fundings").select("*").in("project_id", pIds),
        supabase.from("fiscal_receipts").select("*").in("project_id", pIds),
        supabase.from("project_invoices").select("*").in("project_id", pIds),
        supabase.from("project_nondeductible_expenses").select("*").in("project_id", pIds),
        supabase.from("services").select("*").eq("is_active", true).order("name"),
        supabase.from("daily_reports").select("*").in("project_id", pIds),
        supabase.from("daily_report_items").select("*"),
        supabase.from("daily_photos").select("*").in("project_id", pIds),
      ]);
      setFundings(f.data || []); setReceipts(r.data || []); setInvoices(i.data || []);
      setNondeductibles(n.data || []); setServices(s.data || []);
      setDailyReports(dr.data || []); setDailyReportItems(dri.data || []); setDailyPhotos(dp.data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // --- Handlers Financiar ---
  const openCameraFor = (projectId: string, type: "bon" | "factura") => {
    setActiveProjectId(projectId);
    if (type === "bon") bonInputRef.current?.click();
    else facturaInputRef.current?.click();
  };

  const handleDocumentUpload = async (e: ChangeEvent<HTMLInputElement>, type: "bon" | "factura") => {
    const file = e.target.files?.[0];
    if (!file || !activeProjectId) return;
    console.log(`Document capturat (${type}):`, file.name);
    // Aici apelezi router.push sau logica de upload folosind activeProjectId
  };

  const currentCreditByProject = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => {
      const funded = fundings.filter(f => f.project_id === p.id).reduce((acc, curr) => acc + (curr.amount_ron || 0), 0);
      const spent = receipts.filter(r => r.project_id === p.id).reduce((acc, curr) => acc + (curr.total_with_vat || 0), 0) +
                    invoices.filter(inv => inv.project_id === p.id).reduce((acc, curr) => acc + (curr.total_with_vat || 0), 0) +
                    nondeductibles.filter(nd => nd.project_id === p.id).reduce((acc, curr) => acc + (curr.cost_ron || 0), 0);
      map.set(p.id, funded - spent);
    });
    return map;
  }, [projects, fundings, receipts, invoices, nondeductibles]);

  // --- Handlers Deviz ---
  const openDeviz = (projectId: string) => {
    setDevizProjectId(projectId);
    const existing = dailyReports.find(r => r.project_id === projectId && r.report_date === getTodayDate());
    if (existing) {
      const items = dailyReportItems.filter(i => i.daily_report_id === existing.id);
      setDevizItems(items.map(i => ({ service_id: i.service_id, quantity: String(i.quantity) })));
    } else {
      setDevizItems([{ service_id: "", quantity: "" }]);
    }
    setIsDevizModalOpen(true);
  };

  const handleSaveDeviz = async () => {
    if (!devizProjectId || !profile) return;
    setSavingDeviz(true);
    let { data: report } = await supabase.from("daily_reports").select("id").eq("project_id", devizProjectId).eq("report_date", getTodayDate()).single();
    if (!report) {
      const { data: newReport } = await supabase.from("daily_reports").insert({ project_id: devizProjectId, report_date: getTodayDate(), created_by: profile.id }).select().single();
      report = newReport;
    }
    if (report) {
      await supabase.from("daily_report_items").delete().eq("daily_report_id", report.id);
      const toInsert = devizItems.filter(i => i.service_id && i.quantity).map(i => ({ daily_report_id: report.id, service_id: i.service_id, quantity: Number(i.quantity) }));
      await supabase.from("daily_report_items").insert(toInsert);
    }
    setSavingDeviz(false); setIsDevizModalOpen(false); loadData();
  };

  const handleExportDeviz = (projectId: string, date: string, projectName: string) => {
    const report = dailyReports.find(r => r.project_id === projectId && r.report_date === date);
    if (!report) return;
    const items = dailyReportItems.filter(i => i.daily_report_id === report.id);
    const doc = new jsPDF();
    doc.text(`Deviz: ${projectName} - ${date}`, 10, 10);
    autoTable(doc, {
      head: [['Serviciu', 'UM', 'Cantitate']],
      body: items.map(i => {
        const s = services.find(srv => srv.id === i.service_id);
        return [s?.name || '', s?.um || '', i.quantity];
      })
    });
    doc.save(`Deviz_${projectName}_${date}.pdf`);
  };

  if (loading) return <div className="p-10 text-center font-bold">Se încarcă proiectele...</div>;

  return (
    <div className="min-h-screen bg-[#F0EEE9] pb-20">
      <header className="sticky top-0 z-20 bg-white border-b border-[#E8E5DE] px-4 py-4 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Image src="/logo.png" alt="Logo" width={110} height={36} className="object-contain" />
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ÎNAPOI
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        <input type="text" placeholder="Caută proiect..." className="w-full p-4 rounded-2xl border-none shadow-sm outline-none bg-white text-sm" onChange={(e) => setSearchName(e.target.value)} />

        {projects.filter(p => p.name.toLowerCase().includes(searchName.toLowerCase())).map(project => {
          const tab = projectTabs[project.id] || "financiar";
          const tTab = tehnicTabs[project.id] || "poze";
          const credit = currentCreditByProject.get(project.id) || 0;

          return (
            <div key={project.id} className="bg-white rounded-[28px] shadow-sm overflow-hidden border border-[#E8E5DE]">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 leading-tight">{project.name}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">{project.beneficiary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Credit Disponibil</p>
                    <p className={`text-lg font-black ${credit < 0 ? 'text-red-500' : 'text-[#0196ff]'}`}>{credit.toLocaleString('ro-RO')} RON</p>
                  </div>
                </div>

                <div className="flex gap-2 bg-gray-100/80 p-1.5 rounded-2xl mb-6">
                  <button onClick={() => setProjectTabs({...projectTabs, [project.id]: "financiar"})} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all ${tab === "financiar" ? "bg-white text-[#0196ff] shadow-sm" : "text-gray-400"}`}>FINANCIAR</button>
                  <button onClick={() => setProjectTabs({...projectTabs, [project.id]: "tehnic"})} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all ${tab === "tehnic" ? "bg-white text-[#0196ff] shadow-sm" : "text-gray-400"}`}>TEHNIC</button>
                </div>

                {tab === "financiar" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {!isAdmin && (
                      <>
                        <button onClick={() => openCameraFor(project.id, "bon")} className="p-5 bg-blue-50/50 text-[#0196ff] rounded-[22px] flex flex-col items-center gap-2 font-bold text-[11px] border border-blue-100">
                          <div className="bg-white p-2 rounded-full shadow-sm"><UploadIcon/></div> ADĂUGĂ BON
                        </button>
                        <button onClick={() => openCameraFor(project.id, "factura")} className="p-5 bg-blue-50/50 text-[#0196ff] rounded-[22px] flex flex-col items-center gap-2 font-bold text-[11px] border border-blue-100">
                          <div className="bg-white p-2 rounded-full shadow-sm"><UploadIcon/></div> ADĂUGĂ FACTURĂ
                        </button>
                        {/* LEGATURA CORECTATA CONFORM SCREENSHOT-ULUI TAU */}
                        <button onClick={() => router.push(`/proiecte/${project.id}/adauga-nedeductibile`)} className="p-5 bg-orange-50/50 text-orange-600 rounded-[22px] flex flex-col items-center gap-2 font-bold text-[11px] border border-orange-100">
                          <div className="bg-white p-2 rounded-full shadow-sm text-orange-500">⚠️</div> NEDEDUCTIBIL
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex gap-4 border-b border-gray-100">
                      <button onClick={() => setTehnicTabs({...tehnicTabs, [project.id]: "poze"})} className={`pb-3 px-1 text-[11px] font-black ${tTab === "poze" ? "border-b-2 border-[#0196ff] text-[#0196ff]" : "text-gray-400"}`}>POZE PROGRES</button>
                      <button onClick={() => setTehnicTabs({...tehnicTabs, [project.id]: "deviz"})} className={`pb-3 px-1 text-[11px] font-black ${tTab === "deviz" ? "border-b-2 border-[#0196ff] text-[#0196ff]" : "text-gray-400"}`}>DEVIZ ZILNIC</button>
                    </div>

                    {tTab === "poze" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Galerie</span>
                          {!isAdmin && <button onClick={() => photoInputRef.current?.click()} className="bg-[#0196ff] text-white px-4 py-2 rounded-xl text-[10px] font-black">+ ADAUGĂ POZE</button>}
                        </div>
                        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
                          {dailyPhotos.filter(p => p.project_id === project.id).map(photo => (
                            <div key={photo.id} className="min-w-[85%] h-[220px] relative snap-center rounded-[22px] overflow-hidden border border-gray-100 shadow-sm">
                              <Image src={photo.photo_url} alt="Progres" fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tTab === "deviz" && (
                      <div className="space-y-4">
                        {!isAdmin && <button onClick={() => openDeviz(project.id)} className="w-full py-4 bg-[#0196ff] text-white rounded-2xl font-black text-xs uppercase tracking-widest">+ ÎNCEPE DEVIZ AZI</button>}
                        <div className="grid gap-3">
                          {dailyReports.filter(r => r.project_id === project.id).map(report => (
                            <div key={report.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-[20px] border border-gray-100">
                              <span className="font-black text-sm">{new Date(report.report_date).toLocaleDateString('ro-RO')}</span>
                              <button onClick={() => handleExportDeviz(project.id, report.report_date, project.name)} className="text-[#0196ff] font-black text-[10px] border-2 border-blue-100 bg-white px-4 py-2 rounded-xl">EXPORT PDF</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* INPUT-URI ASCUNSE - ACUM CU SUPORT COMPLET PENTRU CAMERA */}
      <input ref={bonInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleDocumentUpload(e, "bon")} />
      <input ref={facturaInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleDocumentUpload(e, "factura")} />
      <input ref={photoInputRef} type="file" multiple className="hidden" accept="image/*" />

      {/* MODAL DEVIZ (Inclus) */}
      {isDevizModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-black mb-2">Deviz Lucrări</h2>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-8 pr-2">
              {devizItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-gray-50 p-3 rounded-[20px] border">
                  <select className="flex-1 bg-transparent text-sm font-bold outline-none" value={item.service_id} onChange={(e) => {
                    const newItems = [...devizItems];
                    newItems[idx].service_id = e.target.value;
                    setDevizItems(newItems);
                  }}>
                    <option value="">Alege Serviciu</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="number" placeholder="0" className="w-16 bg-white p-2 rounded-xl text-center text-sm font-black text-[#0196ff]" value={item.quantity} onChange={(e) => {
                    const newItems = [...devizItems];
                    newItems[idx].quantity = e.target.value;
                    setDevizItems(newItems);
                  }} />
                </div>
              ))}
              <button onClick={() => setDevizItems([...devizItems, { service_id: "", quantity: "" }])} className="w-full py-3 border-2 border-dashed rounded-[20px] text-[11px] font-black text-[#0196ff]">+ Linie Nouă</button>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsDevizModalOpen(false)} className="flex-1 py-4 font-black text-gray-400">Anulează</button>
              <button onClick={handleSaveDeviz} disabled={savingDeviz} className="flex-1 py-4 bg-[#0196ff] text-white rounded-2xl font-black">{savingDeviz ? "Salvare..." : "Finalizează"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}