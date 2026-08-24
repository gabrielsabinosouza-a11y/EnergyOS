"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Sparkles, ArrowUpRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (name.trim().length < 2) return "Nome deve ter ao menos 2 caracteres.";
    if (password.length < 6) return "Senha deve ter ao menos 6 caracteres.";
    if (password !== confirm) return "As senhas não coincidem.";
    return null;
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name.trim() });
      router.push("/dashboard");
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      setError(code === "auth/email-already-in-use" ? "E-mail já cadastrado." : "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/dashboard");
    } catch {
      setError("Não foi possível criar sua conta com o Google.");
    } finally {
      setLoading(false);
    }
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

        <h1 className="font-display text-2xl tracking-[-0.03em] mb-1">Criar conta</h1>
        <p className="text-sm text-white/40 mb-8">Comece a construir seu ritmo hoje.</p>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleCadastro} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Nome</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="auth-input" placeholder="Seu nome" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="voce@email.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Confirmar senha</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="auth-input" placeholder="Repita a senha" />
          </div>
          <button type="submit" disabled={loading} className="primary-button w-full justify-center mt-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <>Criar conta <ArrowUpRight size={15} /></>}
          </button>
        </form>

        <button type="button" onClick={handleGoogleSignup} disabled={loading} className="google-button mt-3 w-full">
          <Image src="/icons_8bits/Google.png" alt="Google" width={20} height={20} className="pixelated" />
          Criar conta com Google
        </button>

        <p className="mt-6 border-t border-white/8 pt-5 text-center text-sm text-white/40">
          Já tem conta?{" "}
          <Link href="/login" className="text-[#71d4ff] font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </motion.div>
  );
}
