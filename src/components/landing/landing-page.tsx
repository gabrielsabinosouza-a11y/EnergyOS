import Image from "next/image";
import { Gift, Trophy, Users, type LucideIcon } from "lucide-react";
import { HabitTicker } from "./habit-ticker";
import {
  LANDING_ICON_SIZE_ROW,
  LANDING_ICON_STROKE,
  landingIcons,
} from "./icons";
import { LandingHero } from "./landing-hero";
import { LandingMotion } from "./landing-motion";
import { LandingNav } from "./landing-nav";
import { GradientHeading, GlowButton, GlassCard, GrainOverlay, LedNumber, LightBeam, Section } from "./primitives";
import { SpotlightCard } from "./spotlight-card";
import { Storytelling } from "./storytelling";

type FeatureCard = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  text: string;
  shape: string;
  amber?: boolean;
};

const featureCards: FeatureCard[] = [
  { icon: landingIcons.foco, eyebrow: "FOCO", title: "Um espaço para focar de verdade.", text: "Use o timer de foco, acompanhe sessões e convide pessoas para salas compartilhadas.", shape: "feature-wide" },
  { icon: landingIcons.metas, eyebrow: "ORGANIZAÇÃO", title: "Tarefas que saem da cabeça.", text: "Planeje a semana, organize o kanban e acompanhe tarefas recorrentes em um só lugar.", shape: "feature-tall" },
  { icon: landingIcons.metas, eyebrow: "METAS E HÁBITOS", title: "Consistência sem perfeccionismo.", text: "Defina metas, acompanhe hábitos e registre o progresso com flexibilidade.", shape: "feature-card" },
  { icon: landingIcons.energia, eyebrow: "ENERGIA E BEM-ESTAR", title: "Conecte seus hábitos ao seu ritmo.", text: "Registre sono, estudo, treino e energia. Explore relatórios, calendário e tendências pessoais.", shape: "feature-card" },
  { icon: landingIcons.constancia, eyebrow: "PROGRESSO", title: "Veja seu esforço ganhar forma.", text: "Transforme sessões de foco em energias no jardim, acompanhe streaks e desbloqueie conquistas.", shape: "feature-card", amber: true },
  { icon: landingIcons.energia, eyebrow: "MISSÕES DIÁRIAS", title: "Celebre cada avanço.", text: "Complete quests, acompanhe seu XP e resgate recompensas por pequenas vitórias.", shape: "feature-card" },
  { icon: Users, eyebrow: "JUNTO É MAIS LEVE", title: "Compartilhe o caminho, se quiser.", text: "Encontre amigos, participe de grupos, salas de foco e ligas semanais.", shape: "feature-wide" },
  { icon: Gift, eyebrow: "PERSONALIZAÇÃO", title: "Deixe o espaço com a sua cara.", text: "Explore a loja de itens, personalize seu perfil e configure lembretes para a sua rotina.", shape: "feature-card" },
  { icon: Trophy, eyebrow: "CONQUISTAS", title: "Reconheça o caminho percorrido.", text: "Desbloqueie emblemas e acompanhe marcos individuais ou com seu grupo.", shape: "feature-card" },
  { icon: landingIcons.clareza, eyebrow: "VISÃO PESSOAL", title: "Entenda sua evolução com contexto.", text: "Consulte calendário de consistência, resumo mensal e relatórios de sono, estudo, tarefas e metas.", shape: "feature-wide" },
];

function TelemetryStrip() {
  return (
    <GlassCard className="telemetry-strip">
      <div className="telemetry-intro"><span className="landing-eyebrow">SUA ROTINA, EM PERSPECTIVA</span><span>Um painel para acompanhar o que importa para você.</span></div>
      <LedNumber value="7H 42M" label="sono · exemplo visual" />
      <LedNumber value="78%" label="energia · exemplo visual" countTo={78} suffix="%" />
      <LedNumber value="12 DIAS" label="streak · exemplo visual" amber countTo={12} suffix=" DIAS" />
      <LedNumber value="25 MIN" label="foco · exemplo visual" countTo={25} suffix=" MIN" />
      <span className="telemetry-scan" aria-hidden="true" />
    </GlassCard>
  );
}

function FounderEmblem() {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const filled = circ * 0.78;
  const gap = circ - filled;

  return (
    <div className="founder-symbol" aria-hidden="true">
      <svg className="founder-ring" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r={r} className="founder-ring-track" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="founder-ring-arc"
          strokeWidth="6"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
      </svg>
      <Image
        src="/icons_8bits/logo.png"
        alt=""
        width={56}
        height={56}
        className="founder-logo pixelated"
      />
    </div>
  );
}

export function LandingPage() {
  const Energia = landingIcons.energia;

  return (
    <main className="landing-page">
      <LandingMotion />
      <GrainOverlay />
      <LandingNav />

      <LandingHero />

      <div id="visao-geral" className="landing-overview-wrap">
        <Section className="landing-overview">
          <div className="overview-heading">
            <span className="landing-eyebrow">ENERGIA • FOCO • CONSISTÊNCIA</span>
            <h2>Uma visão mais completa<br /><em>do seu dia a dia.</em></h2>
            <p>O energyOS reúne ferramentas para você se conhecer melhor, cuidar da rotina e seguir avançando com intenção.</p>
          </div>
          <TelemetryStrip />
        </Section>
      </div>

      <Section id="como-funciona" className="landing-story-section">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">COMO FUNCIONA</span>
          <p>Do check-in à próxima pequena vitória.</p>
        </div>
        <Storytelling />
      </Section>

      <Section id="recursos" className="landing-features-section">
        <div className="landing-section-heading feature-heading">
          <div><span className="landing-eyebrow">FEITO PARA A VIDA REAL</span><GradientHeading>Mais do que uma lista.<br /><em>Um sistema para você.</em></GradientHeading></div>
          <p>Comece pelo essencial e descubra aos poucos as ferramentas que apoiam seu caminho.</p>
        </div>
        <div className="landing-feature-grid">
          {featureCards.map(({ icon: Icon, eyebrow, title, text, shape, amber }) => (
            <SpotlightCard key={eyebrow} className={shape}>
              <span className={`feature-icon${amber ? " is-amber" : ""}`}>
                <Icon size={18} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
              </span>
              <span className="landing-eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </SpotlightCard>
          ))}
        </div>
      </Section>

      <Section className="landing-ticker-section">
        <div className="ticker-heading"><span className="landing-eyebrow">PEQUENOS PASSOS TAMBÉM CONTAM</span><p>Seu ritmo não precisa ser igual ao de ninguém.</p></div>
        <HabitTicker />
      </Section>

      <Section className="landing-founder-section">
        <FounderEmblem />
        <div className="founder-copy">
          <span className="landing-eyebrow">A IDEIA POR TRÁS DO ENERGYOS</span>
          <blockquote>“Cuidar da própria rotina pode começar com uma pergunta simples: <em>como está sua energia hoje?</em>”</blockquote>
          <p>O energyOS aproxima planejamento e autocuidado para ajudar você a enxergar seus padrões sem transformar cada dia em uma cobrança.</p>
          <span className="founder-signature">Uma ferramenta para seguir no seu ritmo.</span>
        </div>
      </Section>

      <Section className="landing-final-section">
        <LightBeam className="final-beam" />
        <span className="landing-eyebrow">
          <Energia size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
          SEU PRÓXIMO PASSO COMEÇA AQUI
        </span>
        <GradientHeading as="h2">Comece de onde<br /><em>você está.</em></GradientHeading>
        <p>Faça seu primeiro check-in e descubra uma forma mais consciente de organizar o dia.</p>
        <GlowButton href="/cadastro">Criar minha conta</GlowButton>
      </Section>

      <footer className="landing-footer">
        <a href="/" className="landing-brand"><span>energy<span>OS</span></span></a>
        <span>Seu ritmo, com clareza.</span>
        <div><a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a><a href="/login">Entrar</a></div>
        <small>© {new Date().getFullYear()} energyOS</small>
      </footer>
    </main>
  );
}
