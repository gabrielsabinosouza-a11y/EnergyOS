"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthRedirect } from "@/lib/auth-context";
import { Sparkles, ArrowUpRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifAuthed: "/dashboard" });
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch {
      setError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/dashboard");
    } catch {
      setError("Não foi possível entrar com o Google.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) { setError("Digite seu e-mail para recuperar a senha."); return; }
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError("Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return <Loader2 size={28} className="animate-spin text-[#71d4ff]" />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm">
      <div className="panel p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">
            energy<span className="text-[#71d4ff]">OS</span>
          </span>
        </div>

        <h1 className="font-display text-2xl tracking-[-0.03em] mb-1">Bem-vindo de volta</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Entre para continuar seu ritmo.</p>

        {resetSent && (
          <div className="mb-5 rounded-lg border border-[#71d4ff]/20 bg-[#71d4ff]/8 px-4 py-3 text-sm text-[#71d4ff]">
            E-mail de recuperação enviado. Verifique sua caixa de entrada.
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="voce@email.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="primary-button w-full justify-center mt-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <>Entrar <ArrowUpRight size={15} /></>}
          </button>
        </form>

        <button type="button" onClick={handleGoogleLogin} disabled={loading} className="google-button mt-3 w-full">
          <Image src="/icons_8bits/Google.png" alt="Google" width={20} height={20} className="pixelated" />
          Continuar com Google
        </button>

        <button onClick={handleReset} disabled={loading} className="mt-4 text-xs text-[var(--text-faint)] hover:text-[#71d4ff] transition-colors">
          Esqueci minha senha
        </button>

        <p className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center text-sm text-[var(--text-muted)]">
          Não tem conta?{" "}
          <Link href="/cadastro" className="text-[#71d4ff] font-semibold hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </motion.div>
  );
}
