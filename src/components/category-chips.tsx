"use client";

import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import type { Category } from "@/types";
import { categoryIcon, sortCategoriesForPicker, type SmartCategory } from "@/lib/categories";

function withAlpha(hex: string, alpha: number): string {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface CategoryChipsProps {
  categories: Category[];
  selectedId: number;
  onSelect: (id: number) => void;
  onAdd?: () => void;
  addActive?: boolean;
  compact?: boolean;
}

export function CategoryChips({ categories, selectedId, onSelect, onAdd, addActive, compact }: CategoryChipsProps) {
  const sorted = sortCategoriesForPicker(categories);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sorted.map((cat) => {
        const Icon = categoryIcon(cat.icon);
        const selected = cat.id === selectedId;
        return (
          <motion.button
            key={cat.id}
            type="button"
            layout
            onClick={() => onSelect(cat.id)}
            whileTap={{ scale: 0.92 }}
            animate={{ scale: selected ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`flex items-center rounded-full border font-medium transition-all duration-150 cursor-pointer ${
              compact ? "min-h-[34px] gap-1 px-2.5 py-1 text-[11px]" : "min-h-[40px] gap-1.5 px-3.5 py-2 text-xs"
            } ${
              selected
                ? ""
                : "border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-faint)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
            }`}
            style={
              selected
                ? {
                    borderColor: withAlpha(cat.color, 0.55),
                    backgroundColor: withAlpha(cat.color, 0.15),
                    color: cat.color,
                    boxShadow: `0 0 16px -4px ${withAlpha(cat.color, 0.6)}`,
                  }
                : undefined
            }
          >
            <Icon size={compact ? 11 : 13} style={{ color: selected ? cat.color : undefined }} />
            {cat.name}
          </motion.button>
        );
      })}

      {onAdd && (
        <motion.button
          type="button"
          layout
          onClick={onAdd}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`flex items-center rounded-full border border-dashed border-[var(--border-strong)] gap-1 font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all duration-150 cursor-pointer ${
            compact ? "min-h-[34px] px-2.5 py-1 text-[11px]" : "min-h-[40px] px-3.5 py-2 text-xs"
          } ${addActive ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
        >
          {addActive ? <X size={compact ? 11 : 12} /> : <Plus size={compact ? 11 : 12} />}
          Nova categoria
        </motion.button>
      )}
    </div>
  );
}

/** Premium emoji-based category chips for the weekly planner modal. */
interface SmartCategoryChipsProps {
  categories: readonly SmartCategory[];
  selectedId: number;
  onSelect: (id: number) => void;
}

export function SmartCategoryChips({ categories, selectedId, onSelect }: SmartCategoryChipsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {categories.map((cat) => {
        const selected = cat.id === selectedId;
        return (
          <motion.button
            key={cat.id}
            type="button"
            layout
            onClick={() => onSelect(cat.id)}
            whileTap={{ scale: 0.95 }}
            animate={{ scale: selected ? 1.04 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 font-medium transition-all duration-200 cursor-pointer ${
              selected
                ? ""
                : "border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-faint)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
            }`}
            style={
              selected
                ? {
                    borderColor: withAlpha(cat.color, 0.5),
                    backgroundColor: withAlpha(cat.color, 0.12),
                    color: cat.color,
                    boxShadow: `0 0 20px -6px ${withAlpha(cat.color, 0.5)}`,
                  }
                : undefined
            }
          >
            <span className="text-xl leading-none">{cat.emoji}</span>
            <span className="text-[11px] font-medium">{cat.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}