"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Target, Trophy, Sparkles, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/ui";
import { RecapArt } from "@/components/recap/recap-fx";
import {
  ACCENT,
  RECAP_ART,
  RECAP_PALETTE,
  type RecapData,
  capitalizeFirst,
  focusCopy,
  formatMinutes,
  formatShortDate,
  gardenCopy,
  gardenScopeLabel,
  leagueCopy,
  plural,
  streakCopy,
  tierMeta,
  xpCopy,
  xpSegments,
} from "./recap-theme";

/**
 * Tela final do recap — composição editorial em tela cheia.
 *
 * Três regiões visuais:
 *  A. Herói  → mês, usuário, arte 3D central e a frase-resumo do mês.
 *  B. Dashboard de conquistas → grade assimétrica (foco domina, demais
 *     métricas com hierarquia própria) + faixa de detalhamento.
 *  C. Ações → ficam no rodapé do modal (voltar / baixar / compartilhar).
 *
 * No desktop a superfície é larga (~1180px) com corpo rolável; no mobile ela
 * vira uma página vertical imersiva — não uma versão encolhida do modal.
 */

export interface FinalRecapSurfaceProps {
  recap: RecapData;
  userName: string;
  userPhotoUrl?: string;
  monthLabel: string;
}

/** "12 out — 20 out" (período real da melhor sequência). */
function streakRangeLabel(start?: string, end?: string): string | null {
  const from = formatShortDate(start);
  const to = formatShortDate(end);
  if (!from || !to) return null;
  if (from === to) return from;
  return `${from} — ${to}`;
}

/** Painel de vidro com elevação suave no hover. */
function RecapPanel({
  accent,
  delay,
  reduced,
  className = "",
  children,
}: {
  accent: string;
  delay: number;
  reduced: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`group relative min-w-0 ${className}`}
      initial={reduced ? undefined : { opacity: 0, y: 26 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={reduced ? undefined : { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduced ? undefined : { y: -4 }}
    >
      <div
        className="relative h-full overflow-hidden rounded-[22px] border border-white/[.07] p-5 sm:p-6"
        style={{
          background: `linear-gradient(158deg, rgba(255,255,255,.06), rgba(255,255,255,.012) 52%, rgba(255,255,255,.028)), linear-gradient(150deg, ${accent}26, rgba(11,22,39,.5) 46%, ${accent}14)`,
          boxShadow: "0 24px 54px -34px rgba(0,0,0,.92), inset 0 1px 0 rgba(255,255,255,.09)",
        }}
      >
        {/* Spotlight da cor da métrica */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(118% 88% at 6% 0%, ${accent}26, transparent 56%)`,
            opacity: 0.85,
          }}
        />
        {/* Hairline superior */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        />
        <div className="relative z-10 flex h-full min-w-0 flex-col">{children}</div>
      </div>
    </motion.div>
  );
}

/** Rótulo pequeno acima de um valor. */
function MetricLabel({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.2em]"
      style={{ color: accent ?? "rgba(231,244,255,.45)" }}
    >
      {children}
    </span>
  );
}

/** Barra segmentada das fontes de XP (dados reais de `xp_sources`). */
function XpSourcesBar({ recap, reduced }: { recap: RecapData; reduced: boolean }) {
  const segments = xpSegments(recap);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!segments.length || total <= 0) return null;

  return (
    <div className="mt-4">
      <div className="flex h-1.5 w-full gap-[3px] overflow-hidden rounded-full bg-white/[.07]">
        {segments.map((segment, index) => (
          <motion.span
            key={segment.key}
            className="h-full min-w-[6px] rounded-full"
            style={{
              flexGrow: segment.value,
              flexBasis: 0,
              background: segment.color,
              boxShadow: `0 0 12px -2px ${segment.color}`,
            }}
            initial={reduced ? undefined : { scaleX: 0 }}
            animate={reduced ? undefined : { scaleX: 1 }}
            transition={reduced ? undefined : { delay: 0.35 + index * 0.08, duration: 0.5, ease: "easeOut" }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <span className="font-semibold tabular-nums" style={{ color: segment.color }}>
              {segment.value.toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FinalRecapSurface({ recap, userName, userPhotoUrl, monthLabel }: FinalRecapSurfaceProps) {
  const reduced = useReducedMotion() ?? false;

  const garden = recap.gardenCount ?? 0;
  const xp = recap.totalXp ?? 0;
  const { meta: tierMetaData, tier } = tierMeta(recap.leagueTier);
  const tierColor = tierMetaData?.color ?? ACCENT.focus;
  const startTier = tierMeta(recap.leagueAtStart);
  const promoted = Boolean(recap.leaguePromoted) || (Boolean(recap.leagueAtStart) && recap.leagueAtStart !== recap.leagueTier);
  const isLive = recap.status !== "final";

  const focusHours = Math.floor((recap.totalFocusMinutes ?? 0) / 60);
  const focusMins = (recap.totalFocusMinutes ?? 0) % 60;
  const focusUnit = focusHours > 0 ? (focusMins > 0 ? `horas · ${focusMins} min` : "horas") : "minutos";

  const streakRange = streakRangeLabel(recap.streakStartDate, recap.streakEndDate);

  // "outubro de 2026" no texto corrido; "Outubro de 2026" no título.
  const monthTitle = capitalizeFirst(monthLabel);

  const headlineParts = [
    `${formatMinutes(recap.totalFocusMinutes ?? 0)} de foco`,
    recap.longestStreak > 0
      ? `${recap.longestStreak} ${plural(recap.longestStreak, "dia", "dias")} de sequência`
      : "",
    xp > 0 ? `${xp.toLocaleString("pt-BR")} XP` : "",
  ].filter(Boolean);

  const details: Array<{ label: string; value: string; accent?: string }> = [
    { label: "Metas concluídas", value: String(recap.goalsCompleted ?? 0), accent: ACCENT.focus },
    { label: "Missões concluídas", value: String(recap.missionsCompleted ?? 0), accent: ACCENT.streak },
    { label: "Conquistas", value: String(recap.achievementsUnlocked ?? 0), accent: ACCENT.xp },
    { label: "Moedas ganhas", value: (recap.coinsGained ?? 0).toLocaleString("pt-BR"), accent: ACCENT.garden },
    { label: "Moedas gastas", value: (recap.coinsSpent ?? 0).toLocaleString("pt-BR") },
    { label: "Tag do mês", value: recap.productivityTag ?? "—" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      {/* ─── A. Herói ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col gap-5 pb-2 sm:mx-auto sm:max-w-[560px] md:mx-0 md:grid md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] md:grid-rows-[auto_1fr] md:items-start md:max-w-none md:gap-x-8 md:gap-y-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-x-10 lg:pb-4">
        {/* Arte central — peça 3D dominante do mês */}
        <motion.div
          className="order-2 mx-auto w-full max-w-[150px] min-[380px]:max-w-[190px] sm:max-w-[280px] md:order-1 md:col-start-1 md:row-start-1 md:row-span-2 md:mx-0 md:max-w-[280px] md:self-center lg:max-w-[300px]"
          initial={reduced ? undefined : { opacity: 0, scale: 0.86 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={reduced ? undefined : { duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute inset-[-8%] rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 45%, ${ACCENT.xp}59, ${ACCENT.xp}1a 42%, transparent 68%)`,
                filter: "blur(34px)",
              }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-x-[8%] bottom-[6%] h-16 rounded-[50%]"
              style={{
                background: `radial-gradient(ellipse at 50% 50%, ${ACCENT.xp}3d, transparent 70%)`,
                filter: "blur(20px)",
              }}
            />
            <motion.div
              className="relative"
              animate={reduced ? undefined : { y: [0, -11, 0], rotate: [-1.4, 1.4, -1.4] }}
              transition={reduced ? undefined : { duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <RecapArt
                sources={RECAP_ART.heroi}
                alt="Cristal de XP do mês"
                size={330}
                className="h-auto w-full drop-shadow-[0_18px_40px_rgba(169,139,255,.35)]"
                priority
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Título do mês + identidade */}
        <motion.div
          className="order-1 min-w-0 md:order-2 md:col-start-2 md:row-start-1"
          initial={reduced ? undefined : { opacity: 0, y: 18 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { delay: 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)] sm:tracking-[0.34em]">
              energyOS
            </span>
            <span className="h-px w-8 bg-white/15" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.34em]" style={{ color: ACCENT.xp }}>
              Recap de
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: isLive ? `${ACCENT.focus}45` : `${ACCENT.garden}45`,
                background: isLive ? `${ACCENT.focus}14` : `${ACCENT.garden}14`,
                color: isLive ? ACCENT.focus : ACCENT.garden,
              }}
            >
              {isLive ? "Ao vivo" : "Final"}
            </span>
          </div>

          <h2
            className="font-display mt-2 text-[clamp(1.95rem,8.5vw,3.1rem)] font-extrabold leading-[0.98] tracking-[-0.03em] break-words md:text-[clamp(2rem,5.4vw,2.7rem)] lg:text-[clamp(2.6rem,4.2vw,4.1rem)]"
            style={{
              background: "linear-gradient(120deg, #E7F4FF 0%, #5CC8FF 42%, #A98BFF 78%, #FFB067 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {monthTitle}
          </h2>

          <div className="mt-4 flex items-center gap-3">
            {userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userPhotoUrl}
                alt={userName}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/15"
              />
            ) : (
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-base font-bold"
                style={{
                  background: `linear-gradient(140deg, ${ACCENT.focus}, ${ACCENT.xp})`,
                  color: RECAP_PALETTE.midnight,
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold text-[var(--text)]">{userName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Seu mês no EnergyOS</p>
            </div>
          </div>
        </motion.div>

        {/* Frase-resumo */}
        <motion.div
          className="order-3 min-w-0 md:col-start-2 md:row-start-2"
          initial={reduced ? undefined : { opacity: 0, y: 18 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { delay: 0.16, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] lg:text-base">
            Você fechou {monthLabel} com{" "}
            <span className="font-semibold" style={{ color: ACCENT.focus }}>
              {headlineParts[0]}
            </span>
            {headlineParts[1] ? (
              <>
                ,{" "}
                <span className="font-semibold" style={{ color: ACCENT.streak }}>
                  {headlineParts[1]}
                </span>
              </>
            ) : null}
            {headlineParts[2] ? (
              <>
                {" e "}
                <span className="font-semibold" style={{ color: ACCENT.xp }}>
                  {headlineParts[2]}
                </span>
              </>
            ) : null}
            .
          </p>
          {recap.productivityTag ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
              <Sparkles size={13} style={{ color: ACCENT.xp }} />
              <span>
                Tag do mês:{" "}
                <span className="font-semibold text-[var(--text-secondary)]">{recap.productivityTag}</span>
              </span>
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {focusCopy(recap.totalFocusMinutes ?? 0)}
            </p>
          )}
        </motion.div>
      </section>

      {/* ─── B. Dashboard de conquistas ───────────────────────────── */}
      <section className="mt-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:mt-6 lg:grid-cols-12 lg:gap-3.5">
        {/* Foco — painel dominante (~58% da largura) */}
        <RecapPanel accent={ACCENT.focus} delay={0.2} reduced={reduced} className="col-span-full lg:col-span-7">
          <div className="relative flex h-full flex-col justify-between gap-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -top-3 w-24 opacity-90 sm:-right-4 sm:-top-4 sm:w-32 lg:-right-2 lg:-top-6 lg:w-48"
              style={{ filter: `drop-shadow(0 0 34px ${ACCENT.focus}55)` }}
            >
              <RecapArt sources={RECAP_ART.foco} alt="Arte de foco" size={224} className="h-auto w-full" />
            </div>

            <div className="relative z-10 min-w-0 pr-20 sm:pr-28 lg:pr-0">
              <MetricLabel accent={ACCENT.focus}>Foco total do mês</MetricLabel>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <AnimatedNumber
                  value={focusHours > 0 ? focusHours : recap.totalFocusMinutes ?? 0}
                  className="font-display text-[clamp(2.6rem,10vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums lg:text-[clamp(3rem,4.6vw,4.15rem)]"
                  style={{ color: ACCENT.focus }}
                  duration={1.2}
                />
                <span className="font-display text-sm font-semibold text-[var(--text-secondary)]">{focusUnit}</span>
              </div>
            </div>

            <div className="relative z-10 min-w-0">
              <span
                aria-hidden="true"
                className="mb-3 block h-[3px] w-24 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${ACCENT.focus}, transparent)`,
                  boxShadow: `0 0 16px ${ACCENT.focus}`,
                }}
              />
              <p className="max-w-[46ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {focusCopy(recap.totalFocusMinutes ?? 0)}
              </p>
              {recap.topFocusCategory && (
                <span
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ background: `${ACCENT.focus}14`, color: ACCENT.focus }}
                >
                  <Target size={12} />
                  Categoria principal: {recap.topFocusCategory}
                </span>
              )}
            </div>
          </div>
        </RecapPanel>

        {/* Sequência — destaque secundário */}
        <RecapPanel accent={ACCENT.streak} delay={0.26} reduced={reduced} className="lg:col-span-5">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <MetricLabel accent={ACCENT.streak}>Melhor sequência</MetricLabel>
              {recap.streakIsAlive && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ background: `${ACCENT.garden}18`, color: ACCENT.garden }}
                >
                  Ativa
                </span>
              )}
            </div>

            <div className="flex items-end gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <AnimatedNumber
                    value={recap.longestStreak ?? 0}
                    className="font-display text-[clamp(2.1rem,8vw,2.9rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
                    style={{ color: ACCENT.streak }}
                    duration={1.1}
                  />
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    {plural(recap.longestStreak ?? 0, "dia", "dias")}
                  </span>
                </div>
                {streakRange && (
                  <p className="mt-1.5 text-[11px] tracking-wide text-[var(--text-muted)]">{streakRange}</p>
                )}
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none ml-auto w-16 shrink-0 sm:w-20"
                style={{ filter: `drop-shadow(0 0 26px ${ACCENT.streak}66)` }}
              >
                <RecapArt sources={RECAP_ART.sequencia} alt="Arte de sequência" size={80} className="h-auto w-full" />
              </div>
            </div>

            <div>
              <StreakPips days={recap.longestStreak ?? 0} reduced={reduced} />
              <p className="mt-3 max-w-[42ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {streakCopy(recap.longestStreak ?? 0)}
              </p>
            </div>
          </div>
        </RecapPanel>

        {/* Liga — emblema real do tier */}
        <RecapPanel accent={tierColor} delay={0.32} reduced={reduced} className="lg:col-span-4">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <MetricLabel accent={tierColor}>Liga do mês</MetricLabel>
              {promoted && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ background: `${ACCENT.garden}18`, color: ACCENT.garden }}
                >
                  <TrendingUp size={10} />
                  Subiu
                </span>
              )}
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl sm:h-20 sm:w-20"
                style={{
                  background: `radial-gradient(circle at 40% 30%, ${tierColor}33, transparent 70%)`,
                  border: `1px solid ${tierColor}38`,
                }}
              >
                {tierMetaData ? (
                  <RecapArt sources={[tierMetaData.iconPath]} alt={tierMetaData.label} size={64} className="h-auto w-12 sm:w-16" />
                ) : (
                  <Trophy size={30} style={{ color: tierColor }} />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="font-display break-words text-[clamp(1.3rem,5.5vw,1.8rem)] font-extrabold uppercase leading-none tracking-[-0.02em]"
                  style={{ color: tierColor }}
                >
                  {tierMetaData?.label ?? "—"}
                </p>
                <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
                  {tierMetaData?.description ?? "Participe da liga e compete com os melhores."}
                </p>
              </div>
            </div>

            <div className="min-w-0">
              {startTier.meta && tierMetaData && startTier.tier !== tier ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: ACCENT.garden }}>
                  <TrendingUp size={13} />
                  {startTier.meta.label} → {tierMetaData.label}
                </p>
              ) : null}
              <p className="mt-2 text-[12px] leading-snug text-[var(--text-muted)]">
                {leagueCopy(tier, promoted)}
              </p>
            </div>
          </div>
        </RecapPanel>

        {/* Jardim / energias */}
        <RecapPanel accent={ACCENT.garden} delay={0.38} reduced={reduced} className="lg:col-span-4">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-2">
              <MetricLabel accent={ACCENT.garden}>Energias do ano</MetricLabel>
              <span className="text-right text-[10px] font-medium leading-tight text-[var(--text-faint)]">
                {gardenScopeLabel(recap.recapMonth)}
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <AnimatedNumber
                    value={garden}
                    className="font-display text-[clamp(2rem,7.5vw,2.6rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
                    style={{ color: ACCENT.garden }}
                    duration={1.1}
                  />
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    {plural(garden, "energia", "energias")}
                  </span>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none w-10 shrink-0 sm:w-14"
                style={{ filter: `drop-shadow(0 0 22px ${ACCENT.garden}66)` }}
              >
                <RecapArt sources={RECAP_ART.jardim} alt="Arte de energia" size={64} className="h-auto w-full" />
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{gardenCopy(garden)}</p>
          </div>
        </RecapPanel>

        {/* XP do mês — progressão */}
        <RecapPanel accent={ACCENT.xp} delay={0.44} reduced={reduced} className="lg:col-span-4">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <MetricLabel accent={ACCENT.xp}>XP do mês</MetricLabel>
              <div
                aria-hidden="true"
                className="pointer-events-none w-9 shrink-0"
                style={{ filter: `drop-shadow(0 0 18px ${ACCENT.xp}77)` }}
              >
                <RecapArt sources={RECAP_ART.xpProgressao} alt="Arte de XP" size={40} className="h-auto w-full" />
              </div>
            </div>

            <div className="min-w-0">
              <AnimatedNumber
                value={xp}
                className="font-display text-[clamp(2rem,7.5vw,2.6rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
                style={{ color: ACCENT.xp }}
                duration={1.2}
              />
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{xpCopy(xp)}</p>
              <XpSourcesBar recap={recap} reduced={reduced} />
            </div>
          </div>
        </RecapPanel>

        {/* Detalhamento — faixa de dados do mês */}
        <div className="col-span-full lg:col-span-12">
          <motion.div
            className="relative overflow-hidden rounded-[22px] border border-white/[.06] bg-white/[.022] p-5 sm:p-6"
            initial={reduced ? undefined : { opacity: 0, y: 22 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.52, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center gap-3">
              <Sparkles size={13} style={{ color: ACCENT.xp }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Detalhamento do mês
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              {details.map((item) => (
                <div key={item.label} className="flex min-w-0 flex-col justify-end gap-1">
                  <dt className="text-[10px] font-medium uppercase leading-tight tracking-[0.06em] text-[var(--text-faint)] sm:tracking-[0.12em]">
                    {item.label}
                  </dt>
                  <dd
                    className="font-display break-words text-[15px] font-semibold"
                    style={{ color: item.accent ?? "var(--text)" }}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/** Marcadores dos dias consecutivos da sequência (um por dia real). */
function StreakPips({ days, reduced }: { days: number; reduced: boolean }) {
  const shown = Math.min(days, 14);
  const overflow = Math.max(0, days - shown);
  if (days <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: shown }).map((_, index) => (
        <motion.span
          key={index}
          className="h-1.5 w-4 rounded-full"
          style={{ background: ACCENT.streak, boxShadow: `0 0 10px -2px ${ACCENT.streak}` }}
          initial={reduced ? undefined : { opacity: 0, scaleX: 0.2 }}
          animate={reduced ? undefined : { opacity: 1, scaleX: 1 }}
          transition={reduced ? undefined : { delay: 0.3 + index * 0.035, duration: 0.3 }}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] font-semibold" style={{ color: ACCENT.streak }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
