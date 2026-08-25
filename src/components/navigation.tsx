import Link from "next/link";
import { LayoutDashboard, ListTodo, Settings, TrendingUp, Sparkles } from "lucide-react";

export const navigationItems = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/metas", label: "Metas e hábitos", icon: ListTodo },
  { href: "/perfil", label: "Meu perfil", icon: TrendingUp },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ pathname }: { pathname: string }) {
  return <aside className="hidden w-[252px] shrink-0 flex-col border-r border-[var(--border-subtle)] px-6 py-8 lg:fixed lg:inset-y-0 lg:flex"><Link href="/" className="mb-16 flex items-center gap-3 px-2"><span className="brand-mark"><Sparkles size={17} /></span><span className="font-display text-xl font-semibold tracking-[-0.04em]">energy<span className="text-[#71d4ff]">OS</span></span></Link><nav className="space-y-1">{navigationItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`}><Icon size={17} /><span>{label}</span></Link>)}</nav></aside>;
}

export function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <header className="mb-10"><p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[#71d4ff]">{eyebrow}</p><h1 className="font-display text-3xl tracking-[-0.04em] sm:text-4xl">{title}<span className="text-[#ffb86b]">.</span></h1></header>;
}
