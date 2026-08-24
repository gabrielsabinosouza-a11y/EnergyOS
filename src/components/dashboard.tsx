import type { ComponentType, ReactNode } from "react";
import { CheckCircle2, Inbox, LoaderCircle } from "lucide-react";
import { ProgressBar } from "./ui";

export function MetricCard({ label, value, detail, icon: Icon, color }: { label: string; value: string; detail: string; icon: ComponentType<{ size?: number }>; color: string }) {
  return <div className="metric-card"><div className="mb-7 flex items-center justify-between"><div className="metric-icon" style={{ color }}><Icon size={17} /></div><span className="trend">{detail}</span></div><div className="metric-caption">{label}</div><div className="mt-1 font-display text-2xl tracking-[-0.03em]">{value}</div><div className="sparkline" style={{ backgroundColor: color }} /></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><Inbox size={22} /><strong>{title}</strong><span>{description}</span>{action}</div>;
}

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return <div className="empty-state"><LoaderCircle size={22} className="animate-spin" /><span>{label}</span></div>;
}

export function TaskProgress({ completed, total, percentage }: { completed: number; total: number; percentage: number }) {
  return <div className="mb-6 flex items-center gap-4"><ProgressBar value={percentage} /><span className="text-sm font-medium text-white/70">{completed}/{total}</span><span className="text-xs text-white/35">{percentage >= 50 ? "streak garantido" : "ainda dá tempo"}</span></div>;
}

export function CompletionBadge({ complete }: { complete: boolean }) {
  return complete ? <CheckCircle2 size={14} className="text-[#71d4ff]" /> : null;
}
