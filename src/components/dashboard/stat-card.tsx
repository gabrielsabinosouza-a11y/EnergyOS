import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconContent?: ReactNode;
  /** Cor temática (hex) usada no chip, no valor e no brilho. */
  color: string;
}

/** Card de métrica da página Consistência (mesmo visual dos painéis do relatório). */
export function StatCard({ label, value, hint, icon: Icon, iconContent, color }: StatCardProps) {
  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="rounded-full p-2.5"
          style={{
            backgroundColor: `${color}20`,
            color,
            boxShadow: `0 0 0 2px ${color}55, 0 0 12px ${color}66, inset 0 0 8px ${color}33`,
          }}
        >
          {iconContent ?? <Icon size={22} />}
        </div>
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <div className="font-display text-4xl tracking-[-0.04em]" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}
