"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Profile = {
  id: string;
  full_name: string;
  role: "administrator" | "sef_echipa" | "user";
};

type Estimate = {
  id: string;
  project_id: string | null;
  beneficiary: string;
  site_name: string;
  created_by: string;
  created_at: string;
};

type EstimateItem = {
  id: string;
  estimate_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
};

type Service = {
  id: string;
  name: string;
  um: string;
  price_ron: number;
};

export default function DevizePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (!profileData) {
        router.push("/login");
        return;
      }

      const [estimatesRes, itemsRes, servicesRes] = await Promise.all([
        supabase
          .from("estimates")
          .select("id, project_id, beneficiary, site_name, created_by, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("estimate_items")
          .select("id, estimate_id, service_id, quantity, unit_price"),
        supabase.from("services").select("id, name, um, price_ron"),
      ]);

      setProfile(profileData as Profile);
      setEstimates((estimatesRes.data as Estimate[]) || []);
      setItems((itemsRes.data as EstimateItem[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const serviceMap = useMemo(() => {
    return new Map(services.map((service) => [service.id, service]));
  }, [services]);

  const filteredEstimates = useMemo(() => {
    const q = search.toLowerCase();

    return estimates.filter((estimate) => {
      return (
        estimate.beneficiary.toLowerCase().includes(q) ||
        estimate.site_name.toLowerCase().includes(q)
      );
    });
  }, [estimates, search]);

  const getEstimateItems = (estimateId: string) => {
    return items.filter((item) => item.estimate_id === estimateId);
  };

  const getEstimateTotal = (estimateId: string) => {
    return getEstimateItems(estimateId).reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
    }, 0);
  };

  const exportPdf = async (estimate: Estimate) => {
    const estimateItems = getEstimateItems(estimate.id);
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
    doc.text("Deviz lucrari", 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Beneficiar: ${estimate.beneficiary || "-"}`, 14, 45);
    doc.text(`Santier: ${estimate.site_name || "-"}`, 14, 50);
    doc.text(
      `Data deviz: ${new Date(estimate.created_at).toLocaleDateString("ro-RO")}`,
      14,
      55
    );
    doc.text(`Generat la: ${new Date().toLocaleString("ro-RO")}`, 14, 60);

    let total = 0;

    const rows = estimateItems.map((item, index) => {
      const service = serviceMap.get(item.service_id);
      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
      total += lineTotal;

      return [
        String(index + 1),
        service?.name || "-",
        service?.um || "-",
        String(item.quantity),
        `${Number(item.unit_price || 0).toFixed(2)} lei`,
        `${lineTotal.toFixed(2)} lei`,
      ];
    });

    autoTable(doc, {
      startY: 68,
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

    const finalY = (doc as any).lastAutoTable.finalY || 68;

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

    doc.save(
      `deviz_${estimate.site_name.replace(/\s+/g, "_")}_${estimate.id.slice(0, 8)}.pdf`
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
        <div className="rounded-[22px] border border-[#E8E5DE] bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
          <p className="mt-4 text-sm font-semibold text-gray-700">
            Se încarcă...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE9]">
      <header className="sticky top-0 z-20 border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={44}
            className="h-10 w-auto object-contain sm:h-11"
          />

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/devize/creeaza")}
              className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              Creează deviz
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm text-gray-500">Devize</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Istoric devize
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {profile?.full_name}
          </p>

          <div className="mt-5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după beneficiar sau șantier"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-500"
            />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Listă devize
            </p>
            <div className="h-px flex-1 bg-[#E8E5DE]" />
          </div>

          {filteredEstimates.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Nu există devize pentru căutarea curentă.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEstimates.map((estimate) => {
                const estimateItems = getEstimateItems(estimate.id);
                const total = getEstimateTotal(estimate.id);

                return (
                  <div
                    key={estimate.id}
                    className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {estimate.site_name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Beneficiar: {estimate.beneficiary}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(estimate.created_at).toLocaleString("ro-RO")}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <p className="text-lg font-extrabold text-green-700">
                          {total.toFixed(2)} lei
                        </p>

                        <button
                          type="button"
                          onClick={() => exportPdf(estimate)}
                          className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>

                    {estimateItems.length > 0 && (
                      <div className="mt-4 space-y-1 rounded-2xl bg-[#F8F7F3] p-3">
                        {estimateItems.slice(0, 4).map((item) => {
                          const service = serviceMap.get(item.service_id);
                          const lineTotal =
                            Number(item.quantity || 0) * Number(item.unit_price || 0);

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_auto] gap-2 text-xs sm:grid-cols-[1fr_auto_auto]"
                            >
                              <span className="text-gray-700">
                                {service?.name || "-"}
                              </span>
                              <span className="text-gray-500">
                                {item.quantity} {service?.um || ""}
                              </span>
                              <span className="hidden text-right font-medium text-gray-900 sm:block">
                                {lineTotal.toFixed(2)} lei
                              </span>
                            </div>
                          );
                        })}

                        {estimateItems.length > 4 && (
                          <p className="pt-1 text-xs font-semibold text-gray-400">
                            +{estimateItems.length - 4} articole
                          </p>
                        )}
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