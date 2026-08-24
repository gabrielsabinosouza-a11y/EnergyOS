"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { Sparkles, Pencil, Check, Loader2, Flame, Moon, Timer, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [avatarLetter, setAvatarLetter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!user) { router.push("/login"); return null; }

  const displayName = user.displayName ?? "Usuário";
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  async function saveName() {
    if (!name.trim() || name.trim() === displayName) { setEditingName(false); return; }
    if (!auth?.currentUser) return;
    setSaving(true);
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    setSaving(false);
    setSaved(true);
    setEditingName(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function startEdit() {
    setName(displayName);
    setAvatarLetter(initials[0] ?? "");
    setEditingName(true);
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-[#e7f4ff]">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="brand-mark"><Sparkles size={17} /></Link>
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel p-8">
          {/* Avatar + nome */}
          <div className="flex items-center gap-5 mb-8">
            <div className="relative">
              <div className="avatar !w-16 !h-16 !text-xl">{avatarLetter || initials}</div>
              <button onClick={startEdit} className="absolute -bottom-1 -right-1 icon-button small !w-6 !h-6 !rounded-full">
                <Pencil size={11} />
              </button>
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="auth-input !py-1.5 !text-base flex-1"
                  />
                  <button onClick={saveName} disabled={saving} className="icon-button small">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                </div>
              ) : (
                <h1 className="font-display text-2xl tracking-[-0.03em]">{displayName}</h1>
              )}
              <p className="text-sm text-white/40 mt-0.5">{user.email}</p>
              {saved && <p className="text-xs text-[#71d4ff] mt-1">Nome atualizado!</p>}
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3">
            <InfoCard label="Membro desde" value={createdAt} />
            <InfoCard label="Streak atual" value={<span className="flex items-center gap-1.5 text-[#ffb86b]"><Flame size={14} fill="currentColor" />12 dias</span>} />
            <InfoCard label="Nível" value={<span className="text-[#71d4ff]">A+</span>} />
          </div>

          {/* Médias */}
          <div>
            <span className="eyebrow muted mb-4 block">MÉDIAS DA SEMANA</span>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricRow icon={Moon} color="#71d4ff" label="Sono" value="7h 42m" />
              <MetricRow icon={Timer} color="#b69cff" label="Estudo" value="4h 08m" />
              <MetricRow icon={Target} color="#ffb86b" label="Treino" value="3 / 4" />
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div className="metric-caption mb-1">{label}</div>
      <div className="font-display text-base">{value}</div>
    </div>
  );
}

function MetricRow({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: string }) {
  return (
    <div className="metric-card flex items-center gap-3">
      <div className="metric-icon" style={{ color }}><Icon size={15} /></div>
      <div>
        <div className="metric-caption">{label}</div>
        <div className="font-display text-base">{value}</div>
      </div>
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
