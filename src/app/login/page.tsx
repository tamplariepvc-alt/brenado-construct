"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [eroare, setEroare] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEroare("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parola,
    });

    setLoading(false);

    if (error) {
      setEroare(error.message);
      return;
    }

    router.push("/dashboard");
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
        Conectare
      </h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            placeholder="Introdu emailul"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Parolă</label>
          <input
            type="password"
            placeholder="Introdu parola"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3"
            required
          />
        </div>

        {eroare && (
          <p className="text-sm text-red-600">{eroare}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-3 text-white"
        >
          {loading ? "Se conectează..." : "Conectare"}
        </button>
      </form>

      {/* LINK REGISTER */}
      <p className="text-sm text-center mt-4">
        Nu ai cont?{" "}
        <a href="/inregistrare" className="text-blue-600">
          Înregistrează-te
        </a>
      </p>
		  
		  
        </form>
      </div>
    </div>
  );
}
