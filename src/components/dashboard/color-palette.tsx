"use client";

/** Preset colors for habit icons, checkboxes, and progress indicators.
 *  8 hues chosen to be visually distinct: cyan, teal, green, yellow, orange,
 *  red, rose and purple — replacing the previous near-duplicate greens
 *  (#a3e635 / #6bffb8) and orange-vs-yellow (#ffb86b / #ffd166). */
export const HABIT_COLORS = [
  "#71d4ff", // cyan
  "#2dd4bf", // teal
  "#4ade80", // green
  "#fde047", // yellow
  "#ff9f1a", // orange
  "#f87171", // red
  "#fb7185", // rose
  "#c084fc", // violet
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
