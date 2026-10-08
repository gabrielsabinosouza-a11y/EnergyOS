"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { StaticIcon, type LandingAssetKey } from "./landing-assets";
import { GlowButton, LightBeam } from "./primitives";
import { HeroPreviewCard } from "./hero-preview-card";

export function LandingHero() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <LightBeam className="hero-beam" />
      <div className="landing-hero-copy">
        <motion.span
          className="landing-badge"
          initial={reducedMotion ? false : { opacity: 0, y: 12, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="badge-sparkle">✳</span> Novo: check-ins em 10 segundos
        </motion.span>
        <motion.h1
          id="landing-title"
          className="landing-hero-title"
          initial={reducedMotion ? false : { opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.75, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          Seu dia começa
          <br />
          por <em>como você está.</em>
        </motion.h1>
        <motion.p
          className="landing-hero-lede"
          initial={reducedMotion ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.23, ease: [0.22, 1, 0.36, 1] }}
        >
          Em um minuto, registre sua energia, sono ou foco e escolha o próximo passo que cabe no seu ritmo.
        </motion.p>
        <motion.div
          className="landing-hero-actions"
          initial={reducedMotion ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlowButton href="/cadastro">Criar minha conta</GlowButton>
          <GlowButton href="#como-funciona" secondary>
            Ver como funciona
          </GlowButton>
        </motion.div>
        <div className="hero-trust-note">
          <span className="trust-mark" aria-hidden>
            <StaticIcon name="xp" size={14} alt="XP" />
          </span>
          Produtividade com presença, não pressão.
        </div>
      </div>
      <motion.div
        className="landing-hero-art"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-art-orbit orbit-one" aria-hidden="true" />
        <div className="hero-art-orbit orbit-two" aria-hidden="true" />
        <HeroPreviewCard />
      </motion.div>
      <a className="hero-scroll-cue" href="#visao-geral">
        <span>DESCUBRA O ENERGYOS</span>
        <ArrowDown size={14} aria-hidden />
      </a>
    </section>
  );
}
