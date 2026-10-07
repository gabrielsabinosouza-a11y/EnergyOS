"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GlowButton } from "./primitives";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="landing-nav-inner">
        <Link href="/" className="landing-brand" aria-label="energyOS, início">
          <Image src="/icons_8bits/logo.png" alt="" width={28} height={28} className="pixelated" priority />
          <span>energy<span>OS</span></span>
        </Link>
        <nav aria-label="Navegação principal" className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
        </nav>
        <div className="landing-nav-actions">
          <Link href="/login" className="landing-login-link">Entrar</Link>
          <GlowButton href="/cadastro" className="landing-nav-cta">Começar agora</GlowButton>
        </div>
      </div>
    </header>
  );
}
