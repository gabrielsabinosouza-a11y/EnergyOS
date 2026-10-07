"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, Moon, Sparkles, Target, Timer, Zap } from "lucide-react";
import { GlassCard } from "./primitives";

const steps = [
  {
    label: "01 / CHECK-IN",
    title: "Comece pelo que você sente.",
    text: "Registre sono, energia, estudo e treino em um check-in rápido. Sem planilhas, sem complicação.",
    icon: Moon,
  },
  {
    label: "02 / CLAREZA",
    title: "Encontre seu próprio ritmo.",
    text: "Veja tendências e históricos para entender como seus hábitos se conectam aos seus dias.",
    icon: Sparkles,
  },
  {
    label: "03 / CONSTÂNCIA",
    title: "Transforme intenção em pequenas vitórias.",
    text: "Organize tarefas, acompanhe metas e celebre o progresso sem exigir perfeição.",
    icon: Target,
  },
];

function StepPreview({ active }: { active: number }) {
  return (
    <GlassCard className="story-preview">
      <div className="story-preview-top"><span className="story-live-dot" /> SUA VISÃO DE HOJE <span>energyOS</span></div>
      <motion.div key={active} initial={{ opacity: 0, y: 12, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.35 }} className="story-preview-content">
        {active === 0 && (
          <>
            <div className="story-preview-kicker">CHECK-IN DIÁRIO</div>
            <h3>Como você está hoje?</h3>
            <div className="story-energy-choices"><span>Baixa</span><strong>Boa</strong><span>Alta</span></div>
            <div className="story-preview-row"><Moon size={15} /> Sono da noite passada <span>7h 30m</span></div>
            <div className="story-preview-row"><Timer size={15} /> Estudo e movimento <span>Adicionar</span></div>
          </>
        )}
        {active === 1 && (
          <>
            <div className="story-preview-kicker">SEU RESUMO</div>
            <h3>Os sinais ficam mais claros.</h3>
            <div className="story-bars" aria-label="Exemplo ilustrativo de tendências"><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="story-preview-row"><Sparkles size={15} /> Histórico de energia <span>Esta semana</span></div>
            <div className="story-preview-row"><Moon size={15} /> Sono e foco <span>Comparar</span></div>
          </>
        )}
        {active === 2 && (
          <>
            <div className="story-preview-kicker">PEQUENAS VITÓRIAS</div>
            <h3>Um passo de cada vez.</h3>
            <div className="story-task"><Check size={14} /> Planejar a semana <span>Feito</span></div>
            <div className="story-task"><Check size={14} /> 25 minutos de foco <span>Feito</span></div>
            <div className="story-preview-row"><Zap size={15} /> Meta diária <span>Em andamento</span></div>
          </>
        )}
      </motion.div>
      <div className="story-preview-footer"><span>PRÉVIA ILUSTRATIVA</span><span>Seu painel, do seu jeito <Target size={13} /></span></div>
    </GlassCard>
  );
}

export function Storytelling() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const previewY = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [22, -22]);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    setActiveStep(Math.min(2, Math.floor(progress * 3)));
  });

  return (
    <div className="story-layout" ref={containerRef}>
      <div className="story-copy-sticky">
        <span className="landing-eyebrow">UM DIA DE CADA VEZ</span>
        <h2 className="landing-gradient-heading">Mais clareza.<br /><em>Menos cobrança.</em></h2>
        <p className="landing-section-lede">Um lugar para perceber como você está, organizar o que importa e construir constância no seu ritmo.</p>
        <div className="story-step-nav" aria-label="Etapas do energyOS">
          {steps.map((step, index) => (
            <button type="button" key={step.label} onClick={() => document.getElementById(`story-step-${index}`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" })} className={activeStep === index ? "is-active" : ""}>
              <span>{step.label}</span>{step.title}
            </button>
          ))}
        </div>
      </div>
      <motion.div className="story-preview-sticky" style={{ y: previewY }}>
        <StepPreview active={activeStep} />
      </motion.div>
      <div className="story-steps">
        {steps.map((step, index) => (
          <section id={`story-step-${index}`} key={step.label} className="story-step" aria-labelledby={`story-title-${index}`}>
            <span>{step.label}</span>
            <h3 id={`story-title-${index}`}>{step.title}</h3>
            <p>{step.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
