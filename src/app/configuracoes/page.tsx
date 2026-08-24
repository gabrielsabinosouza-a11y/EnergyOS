"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { deleteUser, updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { Sparkles, Loader2, LogOut, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserSettings } from "@/types";

const defaultSettings: Omit<UserSettings, "profileId"> = {
  notificationsEnabled: true,
  preferredTheme: "system",
  sleepTime: "23:00",
  focusTime: "08:00",
};

export default function ConfiguracoesPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState(defaultSettings);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!user) { router.push("/login"); return null; }

  if (!name && user.displayName) setName(user.displayName);

  async function saveName() {
    if (!name.trim()) return;
    if (!auth?.currentUser) return;
    setSavingName(true);
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  async function handleDelete() {
    if (!auth?.currentUser) return;
    setDeleting(true);
    try {
      await deleteUser(auth.currentUser);
      router.push("/cadastro");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function set<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-[#e7f4ff]">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="brand-mark"><Sparkles size={17} /></Link>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span>
        </div>

        <h1 className="font-display text-3xl tracking-[-0.04em] mb-8">Configurações</h1>

        <div className="space-y-4">
          {/* Nome */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">PERFIL</span>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Nome</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input flex-1" />
              <button onClick={saveName} disabled={savingName} className="icon-button">
                {savingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              </button>
            </div>
            {nameSaved && <p className="mt-2 text-xs text-[#71d4ff]">Nome atualizado!</p>}
          </motion.div>

          {/* Notificações + Tema */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">PREFERÊNCIAS</span>
            <div className="space-y-5">
              <ToggleRow
                label="Notificações"
                description="Receber lembretes de check-in e metas"
                checked={settings.notificationsEnabled}
                onChange={(v) => set("notificationsEnabled", v)}
              />
              <div>
                <div className="text-sm font-medium mb-2">Tema da interface</div>
                <div className="flex gap-2">
                  {(["system", "light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => set("preferredTheme", t)}
                      className={`answer-option px-4 py-2 text-xs ${settings.preferredTheme === t ? "selected" : ""}`}
                      style={{ width: "auto" }}
                    >
                      {{ system: "Sistema", light: "Claro", dark: "Escuro" }[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Horários */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">HORÁRIOS PADRÃO</span>
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeField label="Horário de sono" value={settings.sleepTime ?? ""} onChange={(v) => set("sleepTime", v)} />
              <TimeField label="Horário de foco" value={settings.focusTime ?? ""} onChange={(v) => set("focusTime", v)} />
            </div>
          </motion.div>

          {/* Conta */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">CONTA</span>
            <div className="space-y-3">
              <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors">
                <LogOut size={16} /> Sair da conta
              </button>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-400/70 hover:bg-red-500/8 hover:text-red-400 transition-colors">
                  <Trash2 size={16} /> Excluir conta
                </button>
              ) : (
                <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-4">
                  <p className="text-sm text-red-400 mb-3">Tem certeza? Esta ação é irreversível.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30 transition-colors">
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Confirmar exclusão
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-white/40">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#71d4ff]" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</label>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
    </div>
  );
}
