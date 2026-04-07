"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panou Admin</h1>
            <p className="text-sm text-gray-600">
              Gestionare date și module administrative.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Înapoi la dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          
          {/* CENTRE DE COST */}
          <button
            onClick={() => router.push("/admin/centre-de-cost")}
            className="rounded-2xl bg-white p-6 text-left shadow transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">Centre de cost</h2>
            <p className="mt-1 text-sm text-gray-500">
              Vezi toate proiectele și costurile aferente.
            </p>
          </button>

        </div>
      </div>
    </div>
  );
}