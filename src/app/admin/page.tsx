"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
 

  const buttons = [
    "FACTURI FURNIZOR",
    "BONURI FISCALE",
    "FACTURI VÂNZĂRI",
    "CHELTUIELI",
    "VIRAMENTE BANCARE",
    "ALIMENTĂRI DE CARD",
    "ORE EXTRA + WEEKENDS",
    "NOMENCLATOR PRODUSE",
    "STOCURI",
    "RAPORT FINANCIAR",
    "ALTE DOCUMENTE",
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panou Administrator</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Înapoi la dashboard
        </button>
      </div>
  <button
  onClick={() => router.push("/admin/centre-de-cost")}
  className="rounded-2xl bg-white p-5 text-left shadow"
>
  CENTRE DE COST
</button>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {buttons.map((button) => (
          <button
            key={button}
            className="rounded-2xl bg-white p-5 text-left shadow"
          >
            {button}
          </button>
        ))}
      </div>
    </div>
  );
}