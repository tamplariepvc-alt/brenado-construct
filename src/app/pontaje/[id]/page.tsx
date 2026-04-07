"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type ActiveTimeEntry = {
  id: string;
  worker_id: string;
  start_time: string;
  status: string;
  worker_name?: string;
  workers?: {
    id: string;
    full_name: string;
  }[] | null;
};

export default function PontajSantierPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [showWorkersList, setShowWorkersList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [activeEntries, setActiveEntries] = useState<ActiveTimeEntry[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id, name, beneficiary, project_location")
      .eq("id", projectId)
      .single();

    if (projectError || !projectData) {
      router.push("/pontaje");
      return;
    }

    const { data: workersData, error: workersError } = await supabase
      .from("workers")
      .select("id, full_name, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    let parsedWorkers: Worker[] = [];
    if (!workersError && workersData) {
      parsedWorkers = (workersData as Worker[]).filter(
        (worker) => worker.is_active
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: activeData, error: activeError } = await supabase
      .from("time_entries")
      .select(`
        id,
        worker_id,
        start_time,
        status,
        workers:worker_id (
          id,
          full_name
        )
      `)
      .eq("project_id", projectId)
      .eq("work_date", today)
      .eq("status", "activ")
      .is("end_time", null)
      .order("start_time", { ascending: true });

    setProject(projectData as Project);
    setWorkers(parsedWorkers);

    if (!activeError && activeData) {
      const enrichedEntries = (activeData as ActiveTimeEntry[]).map((entry) => {
        const workerFromRelation = entry.workers?.[0]?.full_name;
        const workerFromList = parsedWorkers.find(
          (worker) => worker.id === entry.worker_id
        )?.full_name;

        return {
          ...entry,
          worker_name: workerFromRelation || workerFromList || "-",
        };
      });

      setActiveEntries(enrichedEntries);
    } else {
      setActiveEntries([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId, router]);

  const activeWorkerIds = useMemo(() => {
    return activeEntries.map((entry) => entry.worker_id);
  }, [activeEntries]);

  const availableWorkers = useMemo(() => {
    return workers.filter((worker) => !activeWorkerIds.includes(worker.id));
  }, [workers, activeWorkerIds]);

  const toggleWorker = (workerId: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const selectedWorkersList = useMemo(() => {
    return availableWorkers.filter((worker) => selectedWorkers.includes(worker.id));
  }, [availableWorkers, selectedWorkers]);

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const diff = Math.max(0, now - start);

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const handleStartTimeEntries = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (selectedWorkers.length === 0) {
      alert("Selectează cel puțin un muncitor.");
      return;
    }

    setSubmitting(true);

    const rows = selectedWorkers.map((workerId) => ({
      project_id: projectId,
      worker_id: workerId,
      started_by: user.id,
      start_time: new Date().toISOString(),
      work_date: new Date().toISOString().split("T")[0],
      status: "activ",
    }));

    const { error } = await supabase.from("time_entries").insert(rows);

    if (error) {
      alert("A apărut o eroare la pontare.");
      setSubmitting(false);
      return;
    }

    setSelectedWorkers([]);
    setSubmitting(false);
    await loadData();
  };

  const handleStopTimeEntry = async (entryId: string) => {
    setStoppingId(entryId);

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .eq("id", entryId);

    if (error) {
      alert("A apărut o eroare la oprirea pontajului.");
      setStoppingId(null);
      return;
    }

    setStoppingId(null);
    await loadData();
  };

  const handleStopAllTimeEntries = async () => {
    if (activeEntries.length === 0) return;

    const confirmStop = window.confirm(
      "Sigur vrei să oprești pontajul pentru toți muncitorii activi?"
    );

    if (!confirmStop) return;

    setSubmitting(true);

    const activeIds = activeEntries.map((entry) => entry.id);

    const { error } = await supabase
      .from("time_entries")
      .update({
        end_time: new Date().toISOString(),
        status: "oprit",
      })
      .in("id", activeIds);

    if (error) {
      alert("A apărut o eroare la oprirea tuturor pontajelor.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    await loadData();
  };

  if (loading) {
    return <div className="p-6">Se încarcă datele șantierului...</div>;
  }

  if (!project) {
    return <div className="p-6">Șantierul nu a fost găsit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pontaj șantier</h1>
            <p className="text-sm text-gray-600">
              Selectează echipa care intră la lucru și gestionează pontajele active.
            </p>
          </div>

          <button
            onClick={() => router.push("/pontaje")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la șantiere
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="text-lg font-semibold">{project.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {project.beneficiary || "-"}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium text-gray-500">Locație:</span>{" "}
              {project.project_location || "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pontaje active</h2>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                {activeEntries.length} activi
              </span>
            </div>

            {activeEntries.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nu există muncitori pontați în acest moment.
              </p>
            ) : (
              <div className="space-y-3">
                {activeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-green-200 bg-green-50 p-4"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {entry.worker_name || "-"}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Intrare:{" "}
                          {new Date(entry.start_time).toLocaleTimeString("ro-RO", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-medium text-gray-500">
                          Cronometru
                        </p>
                        <p className="mt-1 text-2xl font-bold text-green-700">
                          {formatDuration(entry.start_time)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStopTimeEntry(entry.id)}
                        disabled={stoppingId === entry.id || submitting}
                        className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {stoppingId === entry.id
                          ? "Se oprește..."
                          : "Oprește pontajul"}
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleStopAllTimeEntries}
                  disabled={submitting || activeEntries.length === 0}
                  className="w-full rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Se procesează..." : "Oprește pontajul pentru toți"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Toți muncitorii activi</h2>

              <button
                type="button"
                onClick={() => setShowWorkersList((prev) => !prev)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
              >
                {showWorkersList ? "Ascunde lista" : "Arată lista"}
              </button>
            </div>

            {showWorkersList && (
              <div className="space-y-3">
                {availableWorkers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu există muncitori disponibili pentru pontare.
                  </p>
                ) : (
                  availableWorkers.map((worker) => (
                    <label
                      key={worker.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {worker.full_name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}

            {selectedWorkersList.length > 0 && (
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Selectați pentru pontaj:
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedWorkersList.map((worker) => (
                    <span
                      key={worker.id}
                      className="rounded-full bg-[#66CC99]/15 px-3 py-2 text-sm font-medium text-[#2f855a]"
                    >
                      {worker.full_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleStartTimeEntries}
                disabled={submitting || selectedWorkers.length === 0}
                className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Se pontează..." : "PONTEAZĂ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}