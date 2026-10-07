import type { Metadata, Viewport } from "next";
import { DM_Mono, IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body", display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-landing-display", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-landing-mono", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "energyOS | Entenda seu ritmo. Organize seu dia.",
  description: "Registre energia, sono e foco. Organize tarefas, acompanhe metas e cuide da sua rotina no seu próprio ritmo.",
  applicationName: "energyOS",
  appleWebApp: {
    capable: true,
    title: "energyOS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons_8bits/logo.png",
    shortcut: "/icons_8bits/logo.png",
    apple: "/icons_pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07111f" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('theme');var m=t==='light'?'light':t==='dark'?'dark':window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'dark';document.documentElement.setAttribute('data-theme',m)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${instrumentSerif.variable} ${plexMono.variable} ${dmMono.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
