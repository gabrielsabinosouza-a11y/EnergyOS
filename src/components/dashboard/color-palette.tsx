"use client";

/** Preset colors for habit icons, checkboxes, and progress indicators. */
export const HABIT_COLORS = [
  "#71d4ff", "#b69cff", "#a3e635", "#ffb86b",
  "#6bffb8", "#ff6b8a", "#ffd166", "#ff6b6b",
];

interface ColorPaletteProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorPalette({ selectedColor, onSelect }: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {HABIT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          aria-label={`Cor ${color}`}
          title={color}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            selectedColor === color ? "ring-2 ring-offset-2 ring-offset-[var(--bg-primary)]" : ""
          }`}
          style={{
            backgroundColor: color,
            boxShadow: selectedColor === color ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${color}` : undefined,
          }}
        >
          {selectedColor === color && (
            <span className="text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}>
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
