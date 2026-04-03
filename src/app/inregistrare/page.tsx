"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();

  const [nume, setNume] = useState("");
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [repetaParola, setRepetaParola] = useState("");
  const [eroare, setEroare] = useState("");
  const [loading, setLoading] = useState(false);

const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  setEroare("");

  if (parola !== repetaParola) {
    setEroare("Parolele nu coincid");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: parola,
  });

  if (error) {
    setEroare(error.message);
    setLoading(false);
    return;
  }

  const user = data.user;

  if (!user) {
    setEroare("Userul nu a fost returnat după înregistrare.");
    setLoading(false);
    return;
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: nume,
    role: "user",
  });

  if (profileError) {
    setEroare("Profilul nu s-a salvat: " + profileError.message);
    setLoading(false);
    return;
  }

  setLoading(false);
  router.push("/login");
};

return (
  <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">

      {/* LOGO */}
      <div className="flex flex-col items-center mb-6">
        <Image
          src="/logo.png"
          alt="Logo"
          width={120}
          height={60}
          className="object-contain"
        />
        <h2 className="mt-3 text-lg font-semibold">
          Brenado Construct
        </h2>
      </div>

      <h1 className="mb-6 text-center text-2xl font-bold">
        Înregistrare
      </h1>

      <form onSubmit={handleRegister} className="space-y-4">

        <input
          type="text"
          placeholder="Nume"
          value={nume}
          onChange={(e) => setNume(e.target.value)}
          className="w-full rounded-lg border px-4 py-3"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-4 py-3"
          required
        />

        <input
          type="password"
          placeholder="Parolă"
          value={parola}
          onChange={(e) => setParola(e.target.value)}
          className="w-full rounded-lg border px-4 py-3"
          required
        />

        <input
          type="password"
          placeholder="Repetă parola"
          value={repetaParola}
          onChange={(e) => setRepetaParola(e.target.value)}
          className="w-full rounded-lg border px-4 py-3"
          required
        />

        {eroare && (
          <p className="text-sm text-red-600">{eroare}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-3 text-white"
        >
          {loading ? "Se creează cont..." : "Înregistrare"}
        </button>

      </form>

      {/* BACK TO LOGIN */}
      <p className="text-sm text-center mt-4">
        Ai deja cont?{" "}
        <a href="/login" className="text-blue-600">
          Înapoi la login
        </a>
      </p>
      </div>
    </div>
  );
}