"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "@/types";
import { renderCategoryGlyph } from "@/lib/categories";

interface CategoryPickerProps {
  id: string;
  categories: Category[];
  value: string;
  allowDefault?: boolean;
  fallbackCategory?: Category;
  onChange: (categoryId: string) => void;
}

const SEARCH_THRESHOLD = 6;
const POPOVER_GAP = 8;

export function CategoryPicker({ id, categories, value, allowDefault = false, fallbackCategory, onChange }: CategoryPickerProps) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<number, HTMLButtonElement>());
  const options = fallbackCategory && !categories.some((category) => category.id === fallbackCategory.id)
    ? [...categories, fallbackCategory]
    : categories;
  const selected = options.find((category) => String(category.id) === value);
  const searchable = options.length >= SEARCH_THRESHOLD;
  const visibleCategories = options.filter((category) =>
    category.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const defaultIsVisible = allowDefault && !query.trim();
  const activeCategory = visibleCategories[activeIndex - (defaultIsVisible ? 1 : 0)];
  const activeIsDefault = defaultIsVisible && activeIndex === 0;
  const optionCount = visibleCategories.length + (defaultIsVisible ? 1 : 0);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    setPosition(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - POPOVER_GAP * 2);
      const below = window.innerHeight - rect.bottom - POPOVER_GAP;
      const above = rect.top - POPOVER_GAP;
      const placeBelow = below >= above;
      const maxHeight = Math.max(140, Math.min(360, placeBelow ? below : above));
      const top = placeBelow
        ? rect.bottom + POPOVER_GAP
        : Math.max(POPOVER_GAP, rect.top - maxHeight - POPOVER_GAP);
      setPosition({
        top,
        left: Math.max(POPOVER_GAP, Math.min(rect.left, window.innerWidth - width - POPOVER_GAP)),
        width,
        maxHeight,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else if (!value && allowDefault) document.getElementById(`${id}-default`)?.focus();
      else if (value) document.getElementById(`${id}-option-${value}`)?.focus();
    });
  }, [allowDefault, id, open, searchable, value]);

  const selectCategory = (category: Category) => {
    onChange(String(category.id));
    close(true);
  };

  const moveActive = (direction: 1 | -1) => {
    if (optionCount === 0) return;
    const next = (activeIndex + direction + optionCount) % optionCount;
    setActiveIndex(next);
    if (defaultIsVisible && next === 0) document.getElementById(`${id}-default`)?.focus();
    else {
      const categoryIndex = next - (defaultIsVisible ? 1 : 0);
      optionRefs.current.get(visibleCategories[categoryIndex]?.id)?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home" && optionCount) {
      event.preventDefault();
      setActiveIndex(0);
      if (defaultIsVisible) document.getElementById(`${id}-default`)?.focus();
      else optionRefs.current.get(visibleCategories[0].id)?.focus();
    } else if (event.key === "End" && optionCount) {
      event.preventDefault();
      const lastIndex = optionCount - 1;
      setActiveIndex(lastIndex);
      const categoryIndex = lastIndex - (defaultIsVisible ? 1 : 0);
      optionRefs.current.get(visibleCategories[categoryIndex].id)?.focus();
    } else if (event.key === "Enter" && activeIsDefault) {
      event.preventDefault();
      onChange("");
      close(true);
    } else if (event.key === "Enter" && activeCategory) {
      event.preventDefault();
      selectCategory(activeCategory);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label="Categoria"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? activeIsDefault ? `${id}-default` : activeCategory ? `${id}-option-${activeCategory.id}` : undefined : undefined}
        onClick={() => {
          if (open) close();
          else {
            const categoryIndex = visibleCategories.findIndex((category) => String(category.id) === value);
            setActiveIndex(categoryIndex < 0 ? 0 : categoryIndex + (defaultIsVisible ? 1 : 0));
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen(true);
          } else if (open) handleKeyDown(event);
        }}
        className="glass-field flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected ? (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border" style={{ color: selected.color, background: `color-mix(in srgb, ${selected.color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${selected.color} 35%, transparent)` }}>
              <span aria-hidden="true">{renderCategoryGlyph(selected.icon, 15)}</span>
            </span>
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--text-faint)]" aria-hidden="true" />
          )}
          <span className="truncate" style={selected ? { color: selected.color } : undefined}>
            {selected?.name ?? "Selecione uma categoria"}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {typeof document !== "undefined" ? createPortal(
        <AnimatePresence>
          {open && position ? (
            <motion.div
              ref={popoverRef}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: reduced ? 0 : 0.16, ease: "easeOut" }}
              className="planner-glass-popover fixed z-[1100] overflow-y-auto p-2"
              style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight, transformOrigin: "top" }}
            >
              {searchable ? (
                <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3">
                  <Search size={15} aria-hidden="true" className="shrink-0 text-[var(--text-faint)]" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar categoria"
                    aria-label="Buscar categoria"
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
                  />
                </div>
              ) : null}
              <div
                id={`${id}-listbox`}
                role="listbox"
                aria-label="Categorias"
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: Math.max(100, position.maxHeight - (searchable ? 68 : 16)) }}
              >
              {defaultIsVisible ? (
                <button
                  id={`${id}-default`}
                  type="button"
                  role="option"
                  aria-selected={!value}
                  tabIndex={activeIndex === 0 ? 0 : -1}
                  onFocus={() => setActiveIndex(0)}
                  onKeyDown={handleKeyDown}
                  onClick={() => { onChange(""); close(true); }}
                  className={`category-option flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                    !value ? "bg-white/[.07]" : "hover:bg-white/[.055]"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--text-faint)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text-secondary)]">Padrão</span>
                  {!value ? <Check size={16} aria-hidden="true" className="text-[var(--accent)]" /> : null}
                </button>
              ) : null}
              {visibleCategories.length ? visibleCategories.map((category, index) => {
                const isSelected = String(category.id) === value;
                const optionIndex = index + (defaultIsVisible ? 1 : 0);
                return (
                    <button
                      key={category.id}
                      ref={(element) => {
                        if (element) optionRefs.current.set(category.id, element);
                        else optionRefs.current.delete(category.id);
                      }}
                      id={`${id}-option-${category.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={optionIndex === activeIndex ? 0 : -1}
                      onFocus={() => setActiveIndex(optionIndex)}
                      onKeyDown={handleKeyDown}
                      onClick={() => selectCategory(category)}
                      className={`category-option flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                        isSelected ? "bg-white/[.07]" : "hover:bg-white/[.055]"
                      }`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ color: category.color, background: `color-mix(in srgb, ${category.color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${category.color} 35%, transparent)` }}>
                        <span aria-hidden="true">{renderCategoryGlyph(category.icon, 16)}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: isSelected ? category.color : undefined }}>
                        {category.name}
                      </span>
                      {isSelected ? <Check size={16} aria-hidden="true" style={{ color: category.color }} /> : null}
                    </button>
                  );
                }) : (
                  <p className="px-3 py-5 text-center text-sm text-[var(--text-muted)]">Nenhuma categoria encontrada.</p>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </>
  );
}
