"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [eroare, setEroare] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEroare("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: parola });
    setLoading(false);
    if (error) { setEroare("Email sau parolă incorecte."); return; }
    router.push("/dashboard");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    setForgotSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
      <div className="w-full max-w-md">
        {!showForgot ? (
          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col items-center">
              <Image src="/logo.png" alt="Logo" width={180} height={56} className="object-contain" />
            </div>

            <h1 className="mb-6 text-center text-2xl font-extrabold tracking-tight text-gray-900">
              Conectare
            </h1>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                <input type="email" placeholder="Introdu emailul" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                  required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Parolă</label>
                <input type="password" placeholder="Introdu parola" value={parola}
                  onChange={(e) => setParola(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                  required />
              </div>

              {eroare && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-700">{eroare}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                {loading ? "Se conectează..." : "Conectare"}
              </button>
            </form>

            <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              className="mt-4 w-full text-center text-sm text-gray-400 transition hover:text-gray-600">
              Am uitat parola
            </button>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#E8E5DE] bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col items-center">
              <Image src="/logo.png" alt="Logo" width={180} height={56} className="object-contain" />
            </div>

            <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-gray-900">
              Resetare parolă
            </h1>
            <p className="mb-6 text-center text-sm text-gray-500">
              Introdu emailul și îți trimitem un link de resetare.
            </p>

            {!forgotSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                  <input type="email" placeholder="Introdu emailul" value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                    required />
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                  {forgotLoading ? "Se trimite..." : "Trimite link de resetare"}
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-center">
                <p className="text-sm font-semibold text-green-800">Link trimis!</p>
                <p className="mt-1 text-xs text-green-700">Verifică emailul {forgotEmail} și urmează instrucțiunile.</p>
              </div>
            )}

            <button type="button" onClick={() => { setShowForgot(false); setForgotSent(false); }}
              className="mt-4 w-full text-center text-sm text-gray-400 transition hover:text-gray-600">
              ← Înapoi la conectare
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
