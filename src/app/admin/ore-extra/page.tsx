"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RecordType = "extra" | "weekend";

export default function AdminExtraWeekendPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<RecordType>("extra");

  const getTwoWeeksRange = () => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;

    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - diffToMonday);

    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - 7);

    const end = new Date(thisMonday);
    end.setDate(thisMonday.getDate() + 6);

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  const loadData = async () => {
    const { start, end } = getTwoWeeksRange();

    const { data, error } = await supabase
      .from("extra_work")
      .select(`
        *,
        workers:worker_id(full_name),
        projects:project_id(name)
      `)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: false });

    if (error) {
      alert("Eroare load admin");
      return;
    }

    setData(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = data.filter((row) => {
    if (type === "extra") return row.extra_hours > 0;
    if (type === "weekend") return row.weekend_days_count > 0;
    return true;
  });

  const handlePay = async (row: any) => {
    const field =
      type === "extra" ? { extra_hours_paid: true } : { weekend_paid: true };

    await supabase.from("extra_work").update(field).eq("id", row.id);

    loadData();
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Ore Extra & Weekend</h1>

      {/* SWITCH */}
      <div className="flex gap-2">
        <button
          onClick={() => setType("extra")}
          className={`px-4 py-2 rounded ${
            type === "extra" ? "bg-purple-600 text-white" : "bg-gray-200"
          }`}
        >
          Ore Extra
        </button>

        <button
          onClick={() => setType("weekend")}
          className={`px-4 py-2 rounded ${
            type === "weekend" ? "bg-orange-600 text-white" : "bg-gray-200"
          }`}
        >
          Weekend
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {filtered.map((row) => (
          <div key={row.id} className="p-4 bg-white rounded-xl shadow">
            <p className="font-bold">
              {row.workers?.full_name || "-"}
            </p>

            <p className="text-sm text-gray-500">
              Proiect: {row.projects?.name || "-"}
            </p>

            <p className="text-sm">
              Data: {new Date(row.work_date).toLocaleDateString("ro-RO")}
            </p>

            {type === "extra" && (
              <>
                <p>Ore: {row.extra_hours}</p>
                <p>Valoare: {row.extra_hours_value} lei</p>

                <span className="text-xs bg-yellow-100 px-2 py-1 rounded">
                  {row.extra_hours_paid ? "Achitat" : "Neachitat"}
                </span>

                {!row.extra_hours_paid && (
                  <button
                    onClick={() => handlePay(row)}
                    className="mt-2 w-full bg-purple-600 text-white py-2 rounded"
                  >
                    Achită ore
                  </button>
                )}
              </>
            )}

            {type === "weekend" && (
              <>
                <p>Sâmbătă: {row.is_saturday ? "Da" : "Nu"}</p>
                <p>Duminică: {row.is_sunday ? "Da" : "Nu"}</p>
                <p>Valoare: {row.weekend_value} lei</p>

                <span className="text-xs bg-yellow-100 px-2 py-1 rounded">
                  {row.weekend_paid ? "Achitat" : "Neachitat"}
                </span>

                {!row.weekend_paid && (
                  <button
                    onClick={() => handlePay(row)}
                    className="mt-2 w-full bg-orange-600 text-white py-2 rounded"
                  >
                    Achită weekend
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}