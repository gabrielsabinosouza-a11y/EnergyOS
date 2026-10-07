"use client";

import { useEffect, useRef, useState } from "react";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { AlertCircle, ArrowUpRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { getPasswordResetErrorMessage } from "@/lib/password-reset-errors";

type ActionState = "loading" | "reset" | "success" | "action-success" | "error" | "invalid";

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  return `${localPart[0]}***@${domain}`;
}

function meetsPasswordRules(password: string) {
  return {
    length: password.length >= 8,
    letter: /[a-z]/i.test(password),
    number: /\d/.test(password),
  };
}

export default function AuthActionPage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const startedRef = useRef(false);
  const submitInProgressRef = useRef(false);
  const oobCodeRef = useRef("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ActionState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const code = params.get("oobCode");
    const apiKey = params.get("apiKey");
    const continueUrl = params.get("continueUrl");
    const language = params.get("lang");
    void apiKey;
    void continueUrl;
    void language;

    if (!code || !mode) {
      queueMicrotask(() => setState("invalid"));
      return;
    }

    oobCodeRef.current = code;
    if (!auth) {
      queueMicrotask(() => {
        setError("O serviço de autenticação está indisponível no momento.");
        setState("error");
      });
      return;
    }

    if (mode === "resetPassword") {
      void verifyPasswordResetCode(auth, code)
        .then((verifiedEmail) => {
          setEmail(verifiedEmail);
          setState("reset");
        })
        .catch((verificationError: unknown) => {
          setError(getPasswordResetErrorMessage(verificationError));
          setState("error");
        });
      return;
    }

    if (mode === "verifyEmail" || mode === "recoverEmail") {
      void applyActionCode(auth, code)
        .then(() => setState("action-success"))
        .catch((actionError: unknown) => {
          setError(getPasswordResetErrorMessage(actionError));
          setState("error");
        });
      return;
    }

    queueMicrotask(() => setState("invalid"));
  }, []);

  const rules = meetsPasswordRules(password);
  const strength = Number(rules.length) + Number(rules.letter) + Number(rules.number);
  const mismatch = confirmPassword !== password;
  const showMismatch = mismatch && (confirmTouched || submitted);

  useEffect(() => {
    if (state === "reset") passwordRef.current?.focus();
  }, [state]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (submitInProgressRef.current) return;

    if (!rules.length || !rules.letter || !rules.number) {
      setError("Use pelo menos 8 caracteres, incluindo uma letra e um número.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      confirmRef.current?.focus();
      return;
    }
    if (!auth) {
      setError("O serviço de autenticação está indisponível no momento.");
      return;
    }

    submitInProgressRef.current = true;
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCodeRef.current, password);
      setState("success");
      const loginUrl = `/login?passwordReset=success&email=${encodeURIComponent(email)}`;
      window.setTimeout(() => router.replace(loginUrl), 4000);
    } catch (submitError: unknown) {
      setError(getPasswordResetErrorMessage(submitError));
    } finally {
      submitInProgressRef.current = false;
      setSubmitting(false);
    }
  }

  function goToLogin() {
    router.replace(`/login?passwordReset=success&email=${encodeURIComponent(email)}`);
  }

  const cardMotion = reducedMotion
    ? {}
    : { initial: { opacity: 0, y: 12, scale: 0.99 }, animate: { opacity: 1, y: 0, scale: 1 } };

  return (
    <motion.section
      {...cardMotion}
      transition={{ duration: 0.25 }}
      className="relative w-full max-w-[420px]"
      aria-labelledby="action-title"
    >
      <div className="panel p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <Image src="/icons_8bits/logo.png" alt="energyOS" width={28} height={28} className="pixelated" />
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">
            energy<span className="text-[var(--accent)]">OS</span>
          </span>
        </div>

        {state === "loading" && (
          <div className="flex min-h-52 flex-col items-center justify-center gap-4 text-center" role="status" aria-live="polite">
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
            <h1 id="action-title" className="text-sm font-medium text-[var(--text-muted)]">Verificando seu link...</h1>
          </div>
        )}

        {state === "reset" && (
          <>
            <h1 id="action-title" className="mb-1 font-display text-2xl tracking-[-0.03em]">Crie sua nova senha</h1>
            <p className="mb-7 text-sm text-[var(--text-muted)]">Escolha uma senha forte para proteger sua conta.</p>

            <input type="email" value={email} readOnly autoComplete="username" tabIndex={-1} aria-hidden="true" className="sr-only" />
            <div className="mb-5">
              <label htmlFor="account-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">E-mail</label>
              <input id="account-email" type="text" value={maskEmail(email)} readOnly className="auth-input cursor-default text-[var(--text-muted)]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Nova senha</label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="auth-input pr-12"
                    aria-describedby="password-rules"
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"} className="absolute inset-y-0 right-2 grid w-9 place-items-center rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div className="mt-3 flex gap-1.5" aria-label={`Força da senha: ${strength} de 3 regras atendidas`}>
                  {[1, 2, 3].map((segment) => (
                    <span key={segment} className={`h-1 flex-1 rounded-full transition-colors ${strength >= segment ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]"}`} />
                  ))}
                </div>
                <ul id="password-rules" className="mt-3 space-y-1 text-xs" aria-live="polite">
                  <li className={rules.length ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>• Pelo menos 8 caracteres</li>
                  <li className={rules.letter ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>• Pelo menos uma letra</li>
                  <li className={rules.number ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>• Pelo menos um número</li>
                </ul>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Confirmar nova senha</label>
                <div className="relative">
                  <input
                    ref={confirmRef}
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    autoComplete="new-password"
                    className="auth-input pr-12"
                    aria-invalid={showMismatch}
                    aria-describedby={showMismatch ? "confirm-error" : undefined}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"} className="absolute inset-y-0 right-2 grid w-9 place-items-center rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {showMismatch && <p id="confirm-error" className="mt-1.5 text-xs text-[var(--red)]" aria-live="polite">As senhas não coincidem.</p>}
              </div>

              {error && <div className="rounded-lg border border-[var(--red)]/25 bg-[var(--red-bg)] px-4 py-3 text-sm text-[var(--red)]" role="alert" aria-live="polite">{error}</div>}

              <button type="submit" disabled={submitting} className="primary-button mt-2 w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                {submitting ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Redefinir senha <ArrowUpRight size={15} /></>}
              </button>
            </form>
          </>
        )}

        {state === "success" && (
          <div className="py-3 text-center" role="status" aria-live="polite">
            <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-bg)] text-[var(--accent)] shadow-[var(--glow-cyan)]">
              <Check size={26} aria-hidden="true" />
            </motion.div>
            <h1 id="action-title" className="mb-2 font-display text-2xl tracking-[-0.03em]">Senha redefinida com sucesso</h1>
            <p className="mb-7 text-sm text-[var(--text-muted)]">Sua conta está protegida com a nova senha.</p>
            <button type="button" onClick={goToLogin} className="primary-button w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Ir para o login <ArrowUpRight size={15} /></button>
          </div>
        )}

        {state === "action-success" && (
          <div className="py-3 text-center" role="status" aria-live="polite">
            <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-bg)] text-[var(--accent)] shadow-[var(--glow-cyan)]"><Check size={26} aria-hidden="true" /></motion.div>
            <h1 id="action-title" className="mb-2 font-display text-2xl tracking-[-0.03em]">Tudo certo!</h1>
            <p className="mb-7 text-sm text-[var(--text-muted)]">Sua solicitação foi confirmada.</p>
            <Link href="/login" className="primary-button w-full justify-center">Ir para o login <ArrowUpRight size={15} /></Link>
          </div>
        )}

        {(state === "error" || state === "invalid") && (
          <div className="py-3 text-center" role="alert" aria-live="polite">
            <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-[var(--red)]/30 bg-[var(--red-bg)] text-[var(--red)]">
              <AlertCircle size={26} aria-hidden="true" />
            </motion.div>
            <h1 id="action-title" className="mb-2 font-display text-2xl tracking-[-0.03em]">{state === "invalid" ? "Link inválido" : "Não foi possível continuar"}</h1>
            <p className="mb-7 text-sm text-[var(--text-muted)]">{state === "invalid" ? "Este link está incompleto ou não é compatível. Solicite um novo link para continuar." : error}</p>
            <Link href="/login?mode=forgot" className="primary-button w-full justify-center">Solicitar novo link <ArrowUpRight size={15} /></Link>
          </div>
        )}

        {state !== "loading" && (
          <p className="mt-6 border-t border-[var(--border-subtle)] pt-5 text-center text-sm">
            <Link href="/login" className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Voltar para o login</Link>
          </p>
        )}
      </div>
    </motion.section>
  );
}
