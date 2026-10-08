"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { HABIT_ICON_CATEGORIES, getIconPath } from "@/lib/habit-icons";
import { uploadToCloudinary } from "@/lib/media";

/** Common emojis for habits. */
const HABIT_EMOJIS = [
  "💪", "🏃", "🧘", "📚", "✍️", "🎯", "💧", "🥗", "😴", "☕",
  "🎵", "🎮", "📱", "💊", "🧹", "🌅", "📝", "🧠", "❤️", "⭐",
  "🔥", "⚡", "🌿", "🍎", "🥤", "🏋️", "🚶", "🧴", "📖", "🎧",
];

interface IconPickerProps {
  iconType: "asset" | "emoji" | "image";
  iconValue: string;
  onSelect: (type: "asset" | "emoji" | "image", value: string) => void;
}

export function IconPicker({ iconType, iconValue, onSelect }: IconPickerProps) {
  const [tab, setTab] = useState<"asset" | "emoji" | "image">(iconType);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Formato inválido. Use PNG, JPG ou WebP.");
      return;
    }
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Imagem muito grande (máx. 2MB).");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadToCloudinary(file);
      onSelect("image", result.secureUrl);
    } catch {
      setUploadError("Falha ao fazer upload. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }, [onSelect]);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-3 flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
        {([
          { id: "asset" as const, label: "Ícones do app" },
          { id: "emoji" as const, label: "Emoji" },
          { id: "image" as const, label: "Imagem" },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`flex-1 cursor-pointer px-3 py-1.5 text-xs font-medium transition ${
              tab === item.id
                ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Asset tab */}
      {tab === "asset" && (
        <div className="max-h-60 space-y-3 overflow-y-auto">
          {HABIT_ICON_CATEGORIES.map((category) => (
            <div key={category.name}>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
                {category.emoji} {category.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {category.icons.map((icon) => {
                  const isSelected = iconType === "asset" && iconValue === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => onSelect("asset", icon)}
                      aria-label={`Ícone ${icon}`}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg border-2 transition ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                          : "border-transparent bg-[var(--bg-surface-hover)] hover:border-[var(--border-subtle)]"
                      }`}
                    >
                      <Image
                        src={getIconPath(icon)}
                        alt={icon.replace(".png", "")}
                        width={28}
                        height={28}
                        className="rounded"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emoji tab */}
      {tab === "emoji" && (
        <div className="flex flex-wrap gap-2">
          {HABIT_EMOJIS.map((emoji) => {
            const isSelected = iconType === "emoji" && iconValue === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect("emoji", emoji)}
                aria-label={`Emoji ${emoji}`}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition ${
                  isSelected
                    ? "border-2 border-[var(--accent)] bg-[var(--accent-bg)]"
                    : "bg-[var(--bg-surface-hover)] hover:bg-[var(--border-subtle)]"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Image tab */}
      {tab === "image" && (
        <div className="space-y-3">
          {iconType === "image" && iconValue ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]">
                <Image
                  src={iconValue}
                  alt="Ícone personalizado"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => onSelect("asset", "target")}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <X size={12} /> Remover imagem
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-subtle)] p-6 text-center transition hover:border-[var(--accent)]">
              <Upload size={20} className="text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">
                Clique para fazer upload (PNG, JPG, WebP, máx. 2MB)
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
          {uploading && <p className="text-center text-xs text-[var(--text-muted)]">Enviando...</p>}
          {uploadError && <p className="text-center text-xs text-red-400">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}
