"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getRedirectResult, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getGoogleAuthErrorMessage, signInWithGoogle } from "@/lib/firebase-auth-errors";
import { useAuthRedirect, setSessionCookie } from "@/lib/auth-context";
import { ArrowLeft, ArrowUpRight, Loader2, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

function maskEmail(value: string): string {
  const [localPart, ...domainParts] = value.trim().split("@");
  if (!localPart || domainParts.length === 0) return "seu e-mail";
  return `${Array.from(localPart)[0]}***@${domainParts.join("@")}`;
}

function getAuthErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "";
}

function getResetRequestErrorMessage(error: unknown): string {
  const code = getAuthErrorCode(error);

  if (code === "auth/too-many-requests") {
    return "Muitas tentativas. Aguarde alguns minutos antes de pedir outro link.";
  }
  if (code === "auth/network-request-failed") {
    return "Sem conexão no momento. Verifique sua internet e tente novamente.";
  }
  if (code === "auth/invalid-email") {
    return "Confira o formato do e-mail e tente novamente.";
  }
  return "Não foi possível enviar o link agora. Tente novamente em instantes.";
}

export default function LoginPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifAuthed: "/dashboard" });
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [passwordResetBanner, setPasswordResetBanner] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const queryHandledRef = useRef(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const focusEmailAfterTransitionRef = useRef(false);

  useEffect(() => {
    if (!queryHandledRef.current) {
      queryHandledRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const requestedForgotMode = params.get("mode") === "forgot";
      const passwordWasReset = params.get("passwordReset") === "success";
      const resetEmail = params.get("email") ?? "";
      queueMicrotask(() => {
        setForgotMode(requestedForgotMode);
        if (passwordWasReset) {
          setPasswordResetBanner(true);
          setEmail(resetEmail);
        }
      });
    }

    if (!auth) return;

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setSessionCookie();
          router.replace("/dashboard");
        }
      })
      .catch((e: unknown) => {
        const code = (e as { code?: string }).code;
        if (code !== "auth/missing-initial-state") {
          setError(getGoogleAuthErrorMessage(e));
        }
      });
  }, [router]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setTimeout(() => setResetCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resetCooldown]);

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
      const result = await signInWithGoogle(auth);
      if (result) {
        setSessionCookie();
        router.push("/dashboard");
      }
    } catch (e: unknown) {
      setError(getGoogleAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const requestedEmail = email.trim();
    if (!requestedEmail) { setError("Digite seu e-mail para recuperar a senha."); return; }
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase não configurado");
      await sendPasswordResetEmail(auth, requestedEmail);
      setEmail(requestedEmail);
      setResetSent(true);
      setResetCooldown(45);
    } catch (e: unknown) {
      if (getAuthErrorCode(e) === "auth/user-not-found") {
        setEmail(requestedEmail);
        setResetSent(true);
        setResetCooldown(45);
      } else {
        setError(getResetRequestErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return <Loader2 size={28} className="animate-spin motion-reduce:animate-none text-[#71d4ff]" />;
  }

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full max-w-sm"
    >
      <div className="panel p-8">
        <div className="mb-8 flex items-center gap-3">
          <Image src="/icons_8bits/logo.png" alt="energyOS" width={28} height={28} className="pixelated" />
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">
            energy<span className="text-[#71d4ff]">OS</span>
          </span>
        </div>

        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={() => {
            if (focusEmailAfterTransitionRef.current) {
              focusEmailAfterTransitionRef.current = false;
              emailInputRef.current?.focus();
            }
          }}
        >
          {resetSent ? (
            <motion.section
              key="reset-sent"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
              aria-live="polite"
            >
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  initial={reducedMotion ? false : { scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 16 }}
                  className="mb-5 grid size-16 place-items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-bg)] text-[var(--accent)] shadow-[var(--glow-cyan)]"
                  aria-hidden="true"
                >
                  <Mail size={28} strokeWidth={1.8} />
                </motion.div>
                <h1 className="mb-2 font-display text-2xl tracking-[-0.03em]">Verifique seu e-mail</h1>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]" role="status">
                  Se houver uma conta associada a{" "}
                  <span className="font-medium text-[var(--text-secondary)]">{maskEmail(email)}</span>,
                  enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <p className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3 text-center text-xs leading-relaxed text-[var(--text-muted)]">
                Não recebeu? Confira também sua pasta de spam ou lixo eletrônico.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400" role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => { void handleReset(); }}
                disabled={loading || resetCooldown > 0}
                className="primary-button w-full justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Mail size={15} aria-hidden="true" />
                )}
                Reenviar e-mail{resetCooldown > 0 ? ` · ${resetCooldown}s` : ""}
              </button>

              <button
                type="button"
                onClick={() => {
                  focusEmailAfterTransitionRef.current = true;
                  setResetSent(false);
                  setError("");
                  setEmail("");
                }}
                className="mt-4 w-full rounded-md py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Usar outro e-mail
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setForgotMode(false);
                  setError("");
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Voltar para o login
              </button>
            </motion.section>
          ) : (
            <motion.div
              key="login-form"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            >
              <h1 className="mb-1 font-display text-2xl tracking-[-0.03em]">
                {forgotMode ? "Recuperar senha" : "Bem-vindo de volta"}
              </h1>
              <p className="mb-8 text-sm text-[var(--text-muted)]">
                {forgotMode ? "Informe seu e-mail para receber um link de recuperação." : "Entre para continuar seu ritmo."}
              </p>

              {passwordResetBanner && (
                <div className="mb-5 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-bg)] px-4 py-3 text-sm text-[var(--accent)]" role="status" aria-live="polite">
                  Senha alterada. Entre com sua nova senha.
                </div>
              )}
              {error && (
                <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400" role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              <form onSubmit={forgotMode ? (event) => { event.preventDefault(); void handleReset(); } : handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">E-mail</label>
                  <input ref={emailInputRef} id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="auth-input" placeholder="voce@email.com" />
                </div>
                {!forgotMode && (
                  <>
                    <div>
                      <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Senha</label>
                      <input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="auth-input" placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={loading} className="primary-button mt-2 w-full justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                      {loading ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <>Entrar <ArrowUpRight size={15} /></>}
                    </button>
                  </>
                )}
                {forgotMode && (
                  <button type="submit" disabled={loading || resetCooldown > 0} className="primary-button mt-2 w-full justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    {loading ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : resetCooldown > 0 ? `Enviar novamente em ${resetCooldown}s` : <>Enviar link de recuperação <ArrowUpRight size={15} /></>}
                  </button>
                )}
              </form>

              {!forgotMode && (
                <>
                  <button type="button" onClick={handleGoogleLogin} disabled={loading} className="google-button mt-3 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    <Image src="/icons_8bits/Google.png" alt="Google" width={20} height={20} className="pixelated" />
                    Continuar com Google
                  </button>

                  <button type="button" onClick={() => { setForgotMode(true); setResetSent(false); setError(""); }} className="mt-4 rounded-md py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    Esqueci minha senha
                  </button>
                </>
              )}

              <p className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center text-sm text-[var(--text-muted)]">
                {forgotMode ? (
                  <button type="button" onClick={() => { setForgotMode(false); setError(""); }} className="rounded-md font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Voltar para entrar</button>
                ) : (
                  <>Não tem conta?{" "}
                    <Link href="/cadastro" className="rounded-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Cadastre-se</Link>
                  </>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
