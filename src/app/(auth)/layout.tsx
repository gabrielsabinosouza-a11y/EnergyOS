import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "energyOS | Acesso",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden theme-bg flex items-center justify-center px-4 py-12">
      <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" />
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#456eff]/10 blur-3xl pointer-events-none" />
      {children}
    </main>
  );
}
