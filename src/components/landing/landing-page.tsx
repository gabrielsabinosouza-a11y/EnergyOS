import { ArrowDown, BarChart3, Check, Flame, Gift, Heart, Moon, Sprout, Target, Timer, Trophy, Users, Zap } from "lucide-react";
import { HabitTicker } from "./habit-ticker";
import { LandingHero } from "./landing-hero";
import { LandingMotion } from "./landing-motion";
import { LandingNav } from "./landing-nav";
import { GradientHeading, GlowButton, GlassCard, GrainOverlay, LedNumber, LightBeam, Section } from "./primitives";
import { SpotlightCard } from "./spotlight-card";
import { Storytelling } from "./storytelling";

const featureCards = [
  { icon: Timer, eyebrow: "FOCO", title: "Um espaço para focar de verdade.", text: "Use o timer de foco, acompanhe sessões e convide pessoas para salas compartilhadas.", shape: "feature-wide" },
  { icon: Check, eyebrow: "ORGANIZAÇÃO", title: "Tarefas que saem da cabeça.", text: "Planeje a semana, organize o kanban e acompanhe tarefas recorrentes em um só lugar.", shape: "feature-tall" },
  { icon: Target, eyebrow: "METAS E HÁBITOS", title: "Consistência sem perfeccionismo.", text: "Defina metas, acompanhe hábitos e registre o progresso com flexibilidade.", shape: "feature-card" },
  { icon: Moon, eyebrow: "ENERGIA E BEM-ESTAR", title: "Conecte seus hábitos ao seu ritmo.", text: "Registre sono, estudo, treino e energia. Explore relatórios, calendário e tendências pessoais.", shape: "feature-card" },
  { icon: Sprout, eyebrow: "PROGRESSO", title: "Veja seu esforço ganhar forma.", text: "Transforme sessões de foco em energias no jardim, acompanhe streaks e desbloqueie conquistas.", shape: "feature-card" },
  { icon: Zap, eyebrow: "MISSÕES DIÁRIAS", title: "Celebre cada avanço.", text: "Complete quests, acompanhe seu XP e resgate recompensas por pequenas vitórias.", shape: "feature-card" },
  { icon: Users, eyebrow: "JUNTO É MAIS LEVE", title: "Compartilhe o caminho, se quiser.", text: "Encontre amigos, participe de grupos, salas de foco e ligas semanais.", shape: "feature-wide" },
  { icon: Gift, eyebrow: "PERSONALIZAÇÃO", title: "Deixe o espaço com a sua cara.", text: "Explore a loja de itens, personalize seu perfil e configure lembretes para a sua rotina.", shape: "feature-card" },
  { icon: Trophy, eyebrow: "CONQUISTAS", title: "Reconheça o caminho percorrido.", text: "Desbloqueie emblemas e acompanhe marcos individuais ou com seu grupo.", shape: "feature-card" },
  { icon: BarChart3, eyebrow: "VISÃO PESSOAL", title: "Entenda sua evolução com contexto.", text: "Consulte calendário de consistência, resumo mensal e relatórios de sono, estudo, tarefas e metas.", shape: "feature-wide" },
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

export function LandingPage() {
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
          {featureCards.map(({ icon: Icon, eyebrow, title, text, shape }) => (
            <SpotlightCard key={eyebrow} className={shape}>
              <span className="feature-icon"><Icon size={18} strokeWidth={1.7} /></span>
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
        <div className="founder-symbol" aria-hidden="true"><span>e</span><i /></div>
        <div className="founder-copy">
          <span className="landing-eyebrow">A IDEIA POR TRÁS DO ENERGYOS</span>
          <blockquote>“Cuidar da própria rotina pode começar com uma pergunta simples: <em>como está sua energia hoje?</em>”</blockquote>
          <p>O energyOS aproxima planejamento e autocuidado para ajudar você a enxergar seus padrões sem transformar cada dia em uma cobrança.</p>
          <span className="founder-signature">Uma ferramenta para seguir no seu ritmo.</span>
        </div>
      </Section>

      <Section className="landing-final-section">
        <LightBeam className="final-beam" />
        <span className="landing-eyebrow"><Zap size={13} /> SEU PRÓXIMO PASSO COMEÇA AQUI</span>
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
