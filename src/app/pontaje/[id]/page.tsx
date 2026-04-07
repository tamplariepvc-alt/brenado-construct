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

  useEffect(() => {
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
        .from("project_workers")
        .select(`
          worker_id,
          workers:worker_id (
            id,
            full_name,
            is_active
          )
        `)
        .eq("project_id", projectId);

      if (!workersError && workersData) {
        const parsedWorkers = workersData
          .map((item: any) => item.workers)
          .filter(Boolean) as Worker[];

        setWorkers(parsedWorkers.filter((worker) => worker.is_active));
      }

      setProject(projectData as Project);
      setLoading(false);
    };

    loadData();
  }, [projectId, router]);

  const toggleWorker = (workerId: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const selectedWorkersList = useMemo(() => {
    return workers.filter((worker) => selectedWorkers.includes(worker.id));
  }, [workers, selectedWorkers]);

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

    alert("Pontaj pornit cu succes.");
    setSubmitting(false);
    router.push("/pontaje");
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
              Selectează echipa care intră la lucru.
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
              <h2 className="text-lg font-semibold">Echipa</h2>

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
                {workers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nu există muncitori alocați acestui șantier.
                  </p>
                ) : (
                  workers.map((worker) => (
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
                      className="rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
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