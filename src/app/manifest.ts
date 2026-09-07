import type { MetadataRoute } from "next";

const APP_NAME = "energyOS";
const APP_DESCRIPTION = "Dashboard pessoal de energia, foco e consistência.";
const BACKGROUND = "#07111f";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "energyOS",
    description: APP_DESCRIPTION,
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND,
    theme_color: "#07111f",
    icons: [
      { src: "/icons_pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons_pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons_pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}