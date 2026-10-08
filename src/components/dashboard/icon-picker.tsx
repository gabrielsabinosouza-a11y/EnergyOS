"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Search, Upload, X } from "lucide-react";
import { DEFAULT_HABIT_ICON_ID, HABIT_ICON_CATEGORIES, getHabitAsset } from "@/lib/habit-icons";
import { HABIT_ICON_MAX_BYTES } from "@/lib/daily-limits";
import { uploadToCloudinary } from "@/lib/media";
import type { HabitIconType } from "@/types";

const HABIT_EMOJIS = ["💪", "🏃", "🧘", "📚", "✍️", "🎯", "💧", "🥗", "😴", "☕", "🎵", "🎮", "📱", "💊", "🧹", "🌅", "📝", "🧠", "❤️", "⭐", "🔥", "⚡", "🌿", "🍎", "🥤", "🏋️", "🚶", "🧴", "📖", "🎧"];

interface IconPickerProps {
  iconType: HabitIconType;
  iconValue: string;
  onSelect: (type: HabitIconType, value: string) => void;
}

async function resizeHabitImage(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = objectUrl;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = Math.floor((image.naturalWidth - side) / 2);
    const sy = Math.floor((image.naturalHeight - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, sx, sy, side, side, 0, 0, 256, 256);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível compactar a imagem.")), "image/webp", 0.82);
    });
    if (blob.size > HABIT_ICON_MAX_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function AssetTile({ id, label, selected, onSelect }: { id: string; label: string; selected: boolean; onSelect: () => void }) {
  const asset = getHabitAsset(id);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallback = getHabitAsset(DEFAULT_HABIT_ICON_ID);
  return (
    <button type="button" onClick={onSelect} aria-label={`Ícone ${label}`} aria-pressed={selected} title={label}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition ${selected ? "border-[var(--accent)] bg-[var(--accent-bg)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] hover:border-[var(--accent)]"}`}>
      {!loaded && <span className="absolute inset-1 animate-pulse rounded bg-white/10" aria-hidden />}
      <Image src={failed ? fallback.path : asset.path} alt={label} width={32} height={32} unoptimized onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(true); }} className="relative z-[1] h-8 w-8 object-contain" />
    </button>
  );
}

export function IconPicker({ iconType, iconValue, onSelect }: IconPickerProps) {
  const [tab, setTab] = useState<HabitIconType>(iconType);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const assets = useMemo(() => HABIT_ICON_CATEGORIES.flatMap((item) => item.icons
    .filter((asset) => category === "Todas" || asset.category === category)
    .filter((asset) => !search || asset.label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))), [category, search]);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploadError("");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Formato inválido. Use PNG, JPG ou WebP.");
      if (file.size > HABIT_ICON_MAX_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");
      setUploading(true);
      const optimized = await resizeHabitImage(file);
      const result = await uploadToCloudinary(optimized);
      onSelect("image", result.secureUrl);
      setTab("image");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Falha ao enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }, [onSelect]);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        {([ ["asset", "Ícones do app"], ["emoji", "Emoji"], ["image", "Imagem"] ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`min-h-8 flex-1 px-2 text-[11px] font-medium ${tab === id ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "asset" && (
        <div>
          <label className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[var(--text-muted)]">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ícone" className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text)] outline-none" />
          </label>
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {["Todas", ...HABIT_ICON_CATEGORIES.map((item) => item.name)].map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${category === item ? "bg-[var(--accent)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="grid max-h-40 grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 overflow-y-auto overscroll-contain pr-1">
            {assets.length ? assets.map((asset) => <AssetTile key={asset.id} id={asset.id} label={asset.label} selected={iconType === "asset" && getHabitAsset(iconValue).id === asset.id} onSelect={() => onSelect("asset", asset.id)} />) : <p className="col-span-full py-4 text-center text-xs text-[var(--text-faint)]">Nenhum ícone encontrado.</p>}
          </div>
        </div>
      )}

      {tab === "emoji" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1.5">
          {HABIT_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => onSelect("emoji", emoji)} aria-label={`Emoji ${emoji}`} aria-pressed={iconType === "emoji" && iconValue === emoji} className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl ${iconType === "emoji" && iconValue === emoji ? "bg-[var(--accent-bg)] ring-1 ring-[var(--accent)]" : "bg-[var(--bg-surface-hover)]"}`}>{emoji}</button>)}
        </div>
      )}

      {tab === "image" && (
        <div className="flex flex-wrap items-center gap-3">
          {iconType === "image" && iconValue && <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]"><Image src={iconValue} alt="Prévia do ícone" fill sizes="48px" unoptimized className="object-cover" /></div>}
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 text-xs text-[var(--text-muted)] hover:border-[var(--accent)]">
            {uploading ? <span className="animate-pulse">Enviando…</span> : <><Upload size={14} /> Enviar imagem (PNG, JPG ou WebP · até 5 MB)</>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          {iconType === "image" && <button type="button" onClick={() => onSelect("asset", DEFAULT_HABIT_ICON_ID)} className="inline-flex items-center gap-1 text-xs text-red-400"><X size={13} /> Remover</button>}
          {uploadError && <p className="basis-full text-xs text-red-400" role="alert">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}
