"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      if (!token) { setChecking(false); return; }

      const { data, error } = await supabase
        .from("invite_tokens")
        .select("id, expires_at, used_at")
        .eq("token", token)
        .single();

      if (error || !data) { setChecking(false); return; }

      // Verifica daca e folosit
      if (data.used_at) { setChecking(false); return; }

      // Verifica daca a expirat
      if (new Date(data.expires_at) < new Date()) { setChecking(false); return; }

      setTokenId(data.id);
      setTokenValid(true);
      setChecking(false);
    };
    checkToken();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) { setError("Completează numele complet."); return; }
    if (!email.trim()) { setError("Completează emailul."); return; }
    if (password.length < 6) { setError("Parola trebuie să aibă cel puțin 6 caractere."); return; }
    if (password !== password2) { setError("Parolele nu coincid."); return; }

    setSubmitting(true);

    // Creaza contul
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (authError || !authData.user) {
      setError(authError?.message || "Eroare la crearea contului.");
      setSubmitting(false);
      return;
    }

    // Marcheaza tokenul ca folosit
    if (tokenId) {
      await supabase.from("invite_tokens").update({
        used_at: new Date().toISOString(),
        used_by: authData.user.id,
      }).eq("id", tokenId);
    }

    setSubmitting(false);
    setSuccess(true);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
      </div>
    );
  }

  if (!token || !tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
        <div className="w-full max-w-md rounded-[24px] border border-[#E8E5DE] bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-red-500" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Link invalid</h2>
          <p className="mt-2 text-sm text-gray-500">
            Acest link de invitație nu este valid, a fost deja folosit sau a expirat.
          </p>
          <p className="mt-3 text-sm text-gray-400">Contactează administratorul pentru un link nou.</p>
          <button onClick={() => router.push("/login")}
            className="mt-6 w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">
            Mergi la conectare
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
        <div className="w-full max-w-md rounded-[24px] border border-[#E8E5DE] bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-green-600" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Cont creat!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Contul tău a fost creat cu succes. Verifică emailul pentru confirmare, apoi conectează-te.
          </p>
          <button onClick={() => router.push("/login")}
            className="mt-6 w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">
            Mergi la conectare
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9] px-4">
      <div className="w-full max-w-md rounded-[24px] border border-[#E8E5DE] bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/logo.png" alt="Logo" width={180} height={56} className="object-contain" />
        </div>

        <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-gray-900">
          Creare cont
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Ai fost invitat să creezi un cont în aplicația Brenado Construct.
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Nume complet *</label>
            <input type="text" value={fullName}
              onChange={(e) => setFullName(e.target.value.toUpperCase().replace(/-/g, ""))}
              autoCapitalize="characters"
              placeholder="EX: ION POPESCU"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-black"
              required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Introdu emailul"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
              required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Parolă *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Minim 6 caractere"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
              required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Confirmă parola *</label>
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
              placeholder="Repetă parola"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
              required />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full rounded-2xl bg-[#0196ff] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {submitting ? "Se creează contul..." : "Creează cont"} 
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F0EEE9]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}
