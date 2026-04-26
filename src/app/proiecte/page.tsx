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
  const [photoViewDate, setPhotoViewDate] = useState<Record<string, string>>({});

  // State pentru Modal Deviz
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
        supabase.from("services").select("*").eq("is_active", true),
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

  // --- Logica Credit ---
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
    let { data: report } = await supabase.from("daily_reports")
      .select("id").eq("project_id", devizProjectId).eq("report_date", getTodayDate()).single();
    
    if (!report) {
      const { data: newReport } = await supabase.from("daily_reports")
        .insert({ project_id: devizProjectId, report_date: getTodayDate(), created_by: profile.id }).select().single();
      report = newReport;
    }

    if (report) {
      await supabase.from("daily_report_items").delete().eq("daily_report_id", report.id);
      const toInsert = devizItems.filter(i => i.service_id && i.quantity).map(i => ({
        daily_report_id: report.id, service_id: i.service_id, quantity: Number(i.quantity)
      }));
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

  if (loading) return <div className="p-10 text-center">Se încarcă...</div>;

  return (
    <div className="min-h-screen bg-[#F0EEE9] pb-20">
      <header className="bg-white p-4 shadow-sm mb-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Image src="/logo.png" alt="Logo" width={120} height={40} />
          <h1 className="font-bold text-gray-800">Sistem Gestiune Proiecte</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 space-y-6">
        {/* Search */}
        <input 
          type="text" placeholder="Caută proiect..." 
          className="w-full p-4 rounded-2xl border-none shadow-sm outline-none"
          onChange={(e) => setSearchName(e.target.value)}
        />

        {projects.filter(p => p.name.toLowerCase().includes(searchName.toLowerCase())).map(project => {
          const tab = projectTabs[project.id] || "financiar";
          const tTab = tehnicTabs[project.id] || "poze";
          const credit = currentCreditByProject.get(project.id) || 0;

          return (
            <div key={project.id} className="bg-white rounded-[24px] shadow-sm overflow-hidden border border-[#E8E5DE]">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">{project.beneficiary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Credit Disponibil</p>
                    <p className={`text-lg font-black ${credit < 0 ? 'text-red-500' : 'text-green-600'}`}>{credit} RON</p>
                  </div>
                </div>

                {/* Tab Switcher Principal */}
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl mb-6">
                  <button onClick={() => setProjectTabs({...projectTabs, [project.id]: "financiar"})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${tab === "financiar" ? "bg-white shadow-sm" : "text-gray-500"}`}>FINANCIAR</button>
                  <button onClick={() => setProjectTabs({...projectTabs, [project.id]: "tehnic"})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${tab === "tehnic" ? "bg-white shadow-sm" : "text-gray-500"}`}>TEHNIC</button>
                </div>

                {tab === "financiar" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {!isAdmin && (
                      <>
                        <button className="p-4 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center font-bold text-xs"><UploadIcon/> ADĂUGĂ BON</button>
                        <button className="p-4 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center font-bold text-xs"><UploadIcon/> ADĂUGĂ FACTURĂ</button>
                        <button className="p-4 bg-orange-50 text-orange-600 rounded-2xl flex flex-col items-center font-bold text-xs">⚠️ NEDEDUCTIBIL</button>
                      </>
                    )}
                    {isAdmin && <div className="col-span-3 text-center py-4 text-gray-400 text-sm italic">Vizualizare raport financiar disponibilă în panoul detaliat.</div>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Sub-Tabs Tehnic */}
                    <div className="flex border-b">
                      <button onClick={() => setTehnicTabs({...tehnicTabs, [project.id]: "poze"})}
                        className={`px-4 py-2 text-xs font-bold ${tTab === "poze" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"}`}>POZE</button>
                      <button onClick={() => setTehnicTabs({...tehnicTabs, [project.id]: "deviz"})}
                        className={`px-4 py-2 text-xs font-bold ${tTab === "deviz" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"}`}>DEVIZ</button>
                    </div>

                    {tTab === "poze" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Galerie Progres</span>
                          {!isAdmin && (
                            <button onClick={() => photoInputRef.current?.click()} className="bg-[#0196ff] text-white px-3 py-1 rounded-lg text-[10px] font-bold">+ ADAUGĂ POZE</button>
                          )}
                        </div>
                        {/* SWIPE GALLERY */}
                        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide">
                          {dailyPhotos.filter(p => p.project_id === project.id).map(photo => (
                            <div key={photo.id} className="min-w-[280px] h-[200px] relative snap-center rounded-2xl overflow-hidden border">
                              <Image src={photo.photo_url} alt="Progres" fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tTab === "deviz" && (
                      <div className="space-y-4">
                        {!isAdmin && (
                          <button onClick={() => openDeviz(project.id)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm">+ ADĂUGĂ DEVIZ ZILNIC</button>
                        )}
                        <div className="space-y-2">
                          {dailyReports.filter(r => r.project_id === project.id).map(report => (
                            <div key={report.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border">
                              <span className="font-bold text-sm">{report.report_date}</span>
                              <button onClick={() => handleExportDeviz(project.id, report.report_date, project.name)} className="text-blue-600 font-bold text-[10px] border border-blue-200 bg-white px-3 py-1 rounded-lg">EXPORT PDF</button>
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

      {/* --- MODAL DEVIZ --- */}
      {isDevizModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black mb-4">Completare Deviz Zilnic</h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto mb-6">
              {devizItems.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <select 
                    className="flex-1 p-3 bg-gray-100 rounded-xl text-sm"
                    value={item.service_id}
                    onChange={(e) => {
                      const newItems = [...devizItems];
                      newItems[idx].service_id = e.target.value;
                      setDevizItems(newItems);
                    }}
                  >
                    <option value="">Selectează Serviciu</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.um})</option>)}
                  </select>
                  <input 
                    type="number" placeholder="Cant." 
                    className="w-20 p-3 bg-gray-100 rounded-xl text-sm"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...devizItems];
                      newItems[idx].quantity = e.target.value;
                      setDevizItems(newItems);
                    }}
                  />
                </div>
              ))}
              <button onClick={() => setDevizItems([...devizItems, { service_id: "", quantity: "" }])} className="text-blue-600 font-bold text-xs">+ Adaugă rând</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDevizModalOpen(false)} className="flex-1 py-3 font-bold text-gray-500">Anulează</button>
              <button onClick={handleSaveDeviz} disabled={savingDeviz} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">
                {savingDeviz ? "Se salvează..." : "Salvează Deviz"}
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={photoInputRef} type="file" multiple className="hidden" accept="image/*" />
    </div>
  );
}