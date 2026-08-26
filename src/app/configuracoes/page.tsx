"use client";

import { useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { deleteUser, updateProfile } from "firebase/auth";
import { useAuthRedirect } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { auth } from "@/lib/firebase";
import { Sparkles, Loader2, LogOut, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserSettings } from "@/types";
import { api } from "@/lib/api-client";

type SettingsForm = Omit<UserSettings, "profileId">;

const defaultSettings: SettingsForm = {
  notificationsEnabled: true,
  preferredTheme: "system",
  sleepTime: "23:00",
  focusTime: "08:00",
};

export default function ConfiguracoesPage() {
  const { user, loading, logout } = useAuthRedirect({ ifGuest: "/" });
  const { setTheme: setUITheme } = useTheme();
  const router = useRouter();

  // Last-saved snapshot — used to compute dirty state
  const savedRef = useRef<SettingsForm>(defaultSettings);
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState("");

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void api.getSettings().then((s) => {
      if (!active) return;
      const loaded: SettingsForm = {
        notificationsEnabled: s.notificationsEnabled,
        preferredTheme: s.preferredTheme,
        sleepTime: s.sleepTime ?? defaultSettings.sleepTime,
        focusTime: s.focusTime ?? defaultSettings.focusTime,
      };
      savedRef.current = loaded;
      setForm(loaded);
      setUITheme(s.preferredTheme);
    }).catch(() => {
      if (active) setLoadError("Não foi possível carregar suas preferências.");
    });
    return () => { active = false; };
  }, [user?.uid, setUITheme]);

  if (loading || !user) return <LoadingScreen />;

  const currentDisplayName = user.displayName ?? "";
  if (!name && currentDisplayName) setName(currentDisplayName);

  function setField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Apply theme to UI immediately for live preview — but don't persist yet
    if (key === "preferredTheme") setUITheme(value as SettingsForm["preferredTheme"]);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await api.saveSettings({
        notificationsEnabled: form.notificationsEnabled,
        preferredTheme: form.preferredTheme,
        sleepTime: form.sleepTime,
        focusTime: form.focusTime,
      });
      savedRef.current = { ...form };
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setSaveError(`Não foi possível salvar as preferências: ${msg}`);
      // Revert theme preview to last saved value on failure
      setUITheme(savedRef.current.preferredTheme);
      setForm({ ...savedRef.current });
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    if (!name.trim() || !auth?.currentUser) return;
    setSavingName(true);
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
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

  return (
    <main className="min-h-screen theme-bg">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="brand-mark"><Sparkles size={17} /></Link>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span>
        </div>

        <h1 className="font-display text-3xl tracking-[-0.04em] mb-8">Configurações</h1>

        {loadError && <p className="mb-5 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">{loadError}</p>}

        <div className="space-y-4">
          {/* Perfil */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">PERFIL</span>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Nome</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input flex-1" />
              <button onClick={saveName} disabled={savingName} className="icon-button">
                {savingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              </button>
            </div>
            {nameSaved && <p className="mt-2 text-xs text-[#71d4ff]">Nome atualizado!</p>}
          </motion.div>

          {/* Preferências */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">PREFERÊNCIAS</span>
            <div className="space-y-5">
              <ToggleRow
                label="Notificações"
                description="Receber lembretes de check-in e metas"
                checked={form.notificationsEnabled}
                onChange={(v) => setField("notificationsEnabled", v)}
              />
              <div>
                <div className="text-sm font-medium mb-2">Tema da interface</div>
                <div className="flex gap-2">
                  {(["system", "light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setField("preferredTheme", t)}
                      className={`answer-option px-4 py-2 text-xs ${form.preferredTheme === t ? "selected" : ""}`}
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
              <TimeField label="Horário de sono" value={form.sleepTime ?? ""} onChange={(v) => setField("sleepTime", v)} />
              <TimeField label="Horário de foco" value={form.focusTime ?? ""} onChange={(v) => setField("focusTime", v)} />
            </div>
          </motion.div>

          {/* Save button */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.13 } }}>
            {saveError && (
              <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="mb-3 rounded-lg border border-green-500/20 bg-green-500/8 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
                <Check size={14} /> Preferências salvas com sucesso
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="primary-button w-full justify-center"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </motion.div>

          {/* Conta */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }} className="panel p-6">
            <span className="eyebrow muted mb-4 block">CONTA</span>
            <div className="space-y-3">
              <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)] transition-colors">
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
                    <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
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
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{description}</div>
      </div>
      <LayoutGroup>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ backgroundColor: checked ? "var(--accent)" : "var(--bg-surface-active)" }}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="block h-5 w-5 rounded-full bg-white shadow-sm"
            style={{ marginLeft: checked ? 20 : 0 }}
          />
        </button>
      </LayoutGroup>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</label>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen theme-bg flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
    </div>
  );
}
