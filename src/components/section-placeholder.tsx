import { ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "./app-shell";

export function SectionPlaceholder({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <AppShell><main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12 lg:py-10"><header className="mb-10"><span className="eyebrow"><Sparkles size={13} /> {eyebrow}</span><h1 className="mt-4 font-display text-4xl tracking-[-0.04em]">{title}<span className="text-[#71d4ff]">.</span></h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/48">{description}</p></header><section className="panel flex min-h-[280px] items-center justify-center p-8 text-center"><div><div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[#71d4ff]/10 text-[#71d4ff]"><ArrowUpRight size={21} /></div><p className="text-sm text-white/45">Esta área está preparada para receber os dados da sua conta.</p></div></section></main></AppShell>;
}
