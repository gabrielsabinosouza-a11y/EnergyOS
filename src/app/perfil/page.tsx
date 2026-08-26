"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useAuthRedirect } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { AppShell } from "@/components/app-shell";
import { Check, Flame, Loader2, Moon, Pencil, Target, Timer, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { DashboardSnapshot } from "@/lib/api-client";

export default function PerfilPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void api.getDashboard().then((snapshot) => {
      if (active) setDashboard(snapshot);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.uid]);

  if (loading || !user) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
      </div>
    </AppShell>
  );

  const displayName = user.displayName ?? "Usuário";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  function startEdit() {
    setName(displayName);
    setEditingName(true);
  }

  async function saveName() {
    if (!name.trim() || name.trim() === displayName) { setEditingName(false); return; }
    if (!auth?.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      await api.updateDisplayName(name.trim());
      setSaved(true);
      setEditingName(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPhotoError("Não foi possível atualizar o nome.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !auth?.currentUser) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setPhotoError("Escolha uma imagem de até 5 MB.");
      return;
    }
    setPhotoError("");
    setPhotoSaving(true);
    try {
      const storage = getStorage();
      const photoRef = ref(storage, `profiles/${auth.currentUser.uid}/avatar`);
      await uploadBytes(photoRef, file, { contentType: file.type });
      const photoURL = await getDownloadURL(photoRef);
      await updateProfile(auth.currentUser, { photoURL });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPhotoError("Não foi possível enviar a foto. Verifique as regras do Firebase Storage.");
    } finally {
      setPhotoSaving(false);
      event.target.value = "";
    }
  }

  const reduced = useReducedMotion();
  const streak = dashboard?.streak?.currentStreak ?? 0;
  const glowAlpha = Math.min(0.15 + streak * 0.01, 0.45).toFixed(2);
  const avatarGlow = streak > 0 ? `0 0 0 3px rgba(255,184,107,${glowAlpha}), 0 0 28px rgba(255,184,107,${glowAlpha})` : undefined;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-xs uppercase tracking-[.2em] text-[#71d4ff]">CONTA</p>
          <h1 className="font-display text-3xl tracking-[-.04em] mb-8">Meu perfil</h1>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel p-8">
            {/* Avatar + nome */}
            <div className="flex items-center gap-5 mb-8">
              <div className="relative">
                <div
                  className="avatar"
                  style={{ width: 64, height: 64, fontSize: 22, boxShadow: avatarGlow, transition: "box-shadow 0.4s ease" }}
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt={displayName} className="w-full h-full rounded-full object-cover" />
                  ) : initials}
                </div>
                <label className="absolute -bottom-1 -right-1 icon-button small !w-7 !h-7 cursor-pointer">
                  {photoSaving ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />}
                  <input type="file" accept="image/*" onChange={uploadPhoto} className="sr-only" disabled={photoSaving} />
                </label>
              </div>
              <div className="flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                      className="auth-input !py-1.5 !text-base flex-1"
                    />
                    <button onClick={saveName} disabled={saving} className="icon-button small">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingName(false)} className="icon-button small"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl tracking-[-0.03em]">{displayName}</h2>
                    <button onClick={startEdit} className="icon-button small !w-7 !h-7"><Pencil size={12} /></button>
                  </div>
                )}
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{user.email}</p>
                {saved && <p className="text-xs text-[#71d4ff] mt-1">Nome atualizado!</p>}
                {photoError && <p className="text-xs text-red-400 mt-1">{photoError}</p>}
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3">
              {[
                { label: "Membro desde", color: "var(--accent)", glow: "rgba(113,212,255,.12)", content: <div className="font-display text-sm">{createdAt}</div> },
                { label: "Streak atual", color: "var(--orange)", glow: "rgba(255,184,107,.12)", content: (
                  <div className="flex items-center gap-1.5 text-[#ffb86b]">
                    <Flame size={14} fill="currentColor" />
                    <span className="font-display text-base">{streak} dias</span>
                  </div>
                )},
                { label: "Provedor", color: "var(--purple)", glow: "rgba(182,156,255,.12)", content: <div className="font-display text-sm">{user.providerData[0]?.providerId === "google.com" ? "Google" : "E-mail"}</div> },
              ].map(({ label, color, glow, content }) => (
                <motion.div
                  key={label}
                  whileHover={reduced ? undefined : { y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="metric-card cursor-default"
                  style={{ boxShadow: `0 0 20px -8px ${glow}` }}
                >
                  <div className="metric-caption mb-1" style={{ color }}>{label}</div>
                  {content}
                </motion.div>
              ))}
            </div>

            {/* Médias */}
            <div>
              <span className="eyebrow muted mb-4 block">MÉDIAS DA SEMANA</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Moon, color: "#71d4ff", label: "Sono" },
                  { icon: Timer, color: "#b69cff", label: "Estudo" },
                  { icon: Target, color: "#ffb86b", label: "Treino" },
                ].map(({ icon: Icon, color, label }) => (
                  <div key={label} className="metric-card flex items-center gap-3">
                    <div className="metric-icon" style={{ color }}><Icon size={15} /></div>
                    <div>
                      <div className="metric-caption">{label}</div>
                      <div className="font-display text-base text-[var(--text-secondary)]">
                        {dashboard?.metrics.find((metric) => metric.kind === (label === "Sono" ? "sleep" : label === "Estudo" ? "study" : "training"))?.value ?? "Sem dados"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--text-faint)]">
                Médias calculadas conforme você registrar check-ins diários.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </AppShell>
  );
}
