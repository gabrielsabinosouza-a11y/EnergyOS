"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import type { Category, WeeklyPlanItem } from "@/types";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";
import { SHORT_WEEKDAYS, todayIso, weekdayOfIso } from "@/lib/planning/dates";
import { formatTimeInput, isValidTime24 } from "@/lib/planning/time";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { PlannerDatePicker } from "./PlannerDatePicker";

type RepeatScope = "occurrence" | "series";
type ReminderOption = "sem-lembrete" | "no-horario" | "5-min" | "10-min" | "30-min" | "1-hora";
type PlanFormValues = {
  planDate: string;
  title: string;
  categoryId?: number;
  startTime: string | null;
  endTime: string | null;
  repeatType: "once" | "weekly";
  repeatDays: number[];
  repeatUntil: string | null;
  reminderOffsetMin: number | null;
};

const REMINDER_OPTIONS: { value: ReminderOption; label: string; offsetMin: number | null }[] = [
  { value: "sem-lembrete", label: "Sem lembrete", offsetMin: null },
  { value: "no-horario", label: "No horário do plano", offsetMin: 0 },
  { value: "5-min", label: "5 minutos antes", offsetMin: 5 },
  { value: "10-min", label: "10 minutos antes", offsetMin: 10 },
  { value: "30-min", label: "30 minutos antes", offsetMin: 30 },
  { value: "1-hora", label: "1 hora antes", offsetMin: 60 },
];

interface PlanDialogProps {
  open: boolean;
  plan?: WeeklyPlanItem | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  categories: Category[];
  onClose: () => void;
  onSave: (plan: WeeklyPlanItem | null, values: PlanFormValues, scope?: RepeatScope) => Promise<void>;
  showNotificationPermissionPrompt?: (onApprove: () => void) => void;
}

const WEEKDAYS = [
  { label: SHORT_WEEKDAYS[0], value: 1 },
  { label: SHORT_WEEKDAYS[1], value: 2 },
  { label: SHORT_WEEKDAYS[2], value: 3 },
  { label: SHORT_WEEKDAYS[3], value: 4 },
  { label: SHORT_WEEKDAYS[4], value: 5 },
  { label: SHORT_WEEKDAYS[5], value: 6 },
  { label: SHORT_WEEKDAYS[6], value: 0 },
];

export function PlanDialog({
  open,
  plan,
  initialDate,
  initialStartTime,
  initialEndTime,
  categories,
  onClose,
  onSave,
  showNotificationPermissionPrompt,
}: PlanDialogProps) {
  // Estado inicializado de forma preguiçosa para garantir valores padrão
  // corretos quando o diálogo é aberto. Usa `key` no PlanDialog para
  // forçar remount quando o plan muda de forma incompatível.
  const [title, setTitle] = useState(() => plan?.title ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [planDate, setPlanDate] = useState(() => plan?.planDate ?? initialDate ?? todayIso());
  const [startTime, setStartTime] = useState(() => plan?.startTime?.slice(0, 5) ?? initialStartTime ?? (plan ? "" : "09:00"));
  const [endTime, setEndTime] = useState(() => initialEndTime ?? (plan ? "" : "10:00"));
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatDaysTouched, setRepeatDaysTouched] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [hasRepeatEnd, setHasRepeatEnd] = useState(false);
  const [reminderOption, setReminderOption] = useState<ReminderOption>(() => {
    const offset = plan?.reminderOffsetMin;
    const found = REMINDER_OPTIONS.find((opt) => opt.offsetMin === offset);
    return found?.value ?? "sem-lembrete";
  });
  const [pendingScope, setPendingScope] = useState<PlanFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const recurringOccurrence = plan?.seriesId !== null && plan?.seriesId !== undefined;

  // Sincroniza o título quando abrimos para editar um plano diferente
  useEffect(() => {
    if (open && plan) setTitle(plan.title ?? "");
  }, [open, plan?.id]);

  /** Categoria efetiva: a escolhida pelo usuário ou a primeira disponível. */
  const selectedCategoryId = categoryId || String(plan?.categoryId ?? categories[0]?.id ?? "");

  function handleDateChange(date: string) {
    setPlanDate(date);
    if (!repeatDaysTouched && date) setRepeatDays([weekdayOfIso(date)]);
  }

  function handleRepeatChange(weekly: boolean) {
    setRepeatWeekly(weekly);
    if (weekly && repeatDays.length === 0) setRepeatDays([weekdayOfIso(planDate)]);
    setError("");
  }

  function toggleRepeatDay(day: number) {
    setRepeatDaysTouched(true);
    setRepeatDays((current) => current.includes(day)
      ? current.filter((selected) => selected !== day)
      : [...current, day].sort((a, b) => (a + 6) % 7 - (b + 6) % 7));
  }

  const selectedReminderOffset = REMINDER_OPTIONS.find((opt) => opt.value === reminderOption)?.offsetMin ?? null;
  const needsPermission = selectedReminderOffset != null;

  function validate(): PlanFormValues | null {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Informe o título do plano.");
      return null;
    }
    if (trimmedTitle.length > PLAN_NAME_MAX) {
      setError(`Use até ${PLAN_NAME_MAX} caracteres.`);
      return null;
    }
    const parsedCategoryId = Number(selectedCategoryId);
    if (!recurringOccurrence && selectedCategoryId && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      setError("Escolha uma categoria.");
      return null;
    }
    if ((startTime && !isValidTime24(startTime)) || (endTime && !isValidTime24(endTime))) {
      setError("Informe os horários no formato 24 horas, como 09:00.");
      return null;
    }
    if (startTime && endTime && !recurringOccurrence && endTime <= startTime) {
      setError("O horário de fim deve ser posterior ao início.");
      return null;
    }
    if (repeatWeekly && repeatDays.length === 0) {
      setError("Selecione pelo menos um dia da semana.");
      return null;
    }
    if (repeatWeekly && hasRepeatEnd && (!repeatUntil || repeatUntil < planDate)) {
      setError("A data final deve ser igual ou posterior à data inicial.");
      return null;
    }
    return {
      planDate,
      title: trimmedTitle,
      categoryId: recurringOccurrence
        ? plan!.categoryId
        : selectedCategoryId ? parsedCategoryId : undefined,
      startTime: startTime || null,
      endTime: recurringOccurrence ? null : endTime || null,
      repeatType: repeatWeekly ? "weekly" : "once",
      repeatDays: repeatWeekly ? repeatDays : [],
      repeatUntil: repeatWeekly && hasRepeatEnd ? repeatUntil : null,
      reminderOffsetMin: selectedReminderOffset,
    };
  }

  async function save(values: PlanFormValues, scope?: RepeatScope) {
    setLoading(true);
    setError("");
    try {
      // Handle notification permission if needed
      if (needsPermission && showNotificationPermissionPrompt) {
        let permissionGranted = false;
        await new Promise<void>((resolve) => {
          showNotificationPermissionPrompt(() => { permissionGranted = true; resolve(); });
        });
        if (!permissionGranted) {
          // User denied permission - still save the plan but without reminder
          values.reminderOffsetMin = null;
        }
      }
      await onSave(plan ?? null, values, scope);
      setPendingScope(null);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o plano.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const values = validate();
    if (!values) return;
    if (recurringOccurrence) {
      setError("");
      setPendingScope(values);
      return;
    }
    void save(values);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => pendingScope ? setPendingScope(null) : onClose()}
        title={plan ? "Editar plano" : "Novo plano"}
        description={recurringOccurrence
          ? "Escolha se as alterações serão aplicadas a esta ocorrência ou à série."
          : "Defina título, categoria, data e horário do plano."}
        variant="center"
        panelClassName="max-w-[480px]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="ml-auto">
              Cancelar
            </Button>
            <Button type="submit" form="planner-plan-form" loading={loading} disabled={loading}>
              {plan ? "Salvar alterações" : "Criar plano"}
            </Button>
          </>
        }
      >
        <form id="planner-plan-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="planner-plan-title" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Título
            </label>
            <input
              id="planner-plan-title"
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Ir à academia"
              maxLength={PLAN_NAME_MAX}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="planner-plan-category" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Categoria
            </label>
            <select
              id="planner-plan-category"
              value={selectedCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              disabled={Boolean(recurringOccurrence)}
            >
              {!recurringOccurrence ? <option value="">Padrão</option> : null}
              {!categories.some((category) => String(category.id) === selectedCategoryId)
                ? <option value={selectedCategoryId}>{plan?.category.name ?? "Categoria atual"}</option>
                : null}
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="planner-plan-date" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Data
            </label>
            <PlannerDatePicker
              id="planner-plan-date"
              label="Data do plano"
              value={planDate}
              onChange={handleDateChange}
              disabled={Boolean(recurringOccurrence)}
            />
          </div>

          <div className={`grid gap-3 ${recurringOccurrence ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="space-y-1">
              <label htmlFor="planner-plan-start-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Início
              </label>
              <input
                id="planner-plan-start-time"
                type="text"
                inputMode="numeric"
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                maxLength={5}
                value={startTime}
                onChange={(event) => setStartTime(formatTimeInput(event.target.value))}
                placeholder="09:00"
                aria-label="Horário de início, formato 24 horas"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 tabular-nums"
              />
            </div>
            {!recurringOccurrence ? (
              <div className="space-y-1">
                <label htmlFor="planner-plan-end-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Fim
                </label>
                <input
                  id="planner-plan-end-time"
                  type="text"
                  inputMode="numeric"
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  maxLength={5}
                  value={endTime}
                  onChange={(event) => setEndTime(formatTimeInput(event.target.value))}
                  placeholder="10:00"
                  aria-label="Horário de fim, formato 24 horas"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 tabular-nums"
                />
              </div>
            ) : null}
          </div>

          {!plan ? (
            <section className="space-y-3 border-t border-[var(--border-subtle)] pt-4" aria-labelledby="planner-repeat-label">
              <div>
                <h3 id="planner-repeat-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Repetir
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={!repeatWeekly}
                    onClick={() => handleRepeatChange(false)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      !repeatWeekly
                        ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    Não repetir
                  </button>
                  <button
                    type="button"
                    aria-pressed={repeatWeekly}
                    onClick={() => handleRepeatChange(true)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      repeatWeekly
                        ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <Repeat size={14} aria-hidden="true" />
                    Semanalmente
                  </button>
                </div>
              </div>

              {repeatWeekly ? (
                <>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
                    {WEEKDAYS.map(({ label, value }) => {
                      const selected = repeatDays.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleRepeatDay(value)}
                          className={`min-w-10 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-primary)]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-[var(--text-secondary)]">Fim da repetição</legend>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="radio"
                        name="planner-repeat-end"
                        checked={!hasRepeatEnd}
                        onChange={() => setHasRepeatEnd(false)}
                        className="accent-[var(--accent)]"
                      />
                      Sem data final
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="radio"
                        name="planner-repeat-end"
                        checked={hasRepeatEnd}
                        onChange={() => setHasRepeatEnd(true)}
                        className="accent-[var(--accent)]"
                      />
                      Repetir até
                    </label>
                    {hasRepeatEnd ? (
                      <PlannerDatePicker
                        id="planner-repeat-until"
                        label="Repetir até"
                        value={repeatUntil}
                        onChange={setRepeatUntil}
                        placeholder="Escolha a data final"
                      />
                    ) : null}
                  </fieldset>
                </>
              ) : null}

              {!recurringOccurrence && (
                <section className="space-y-3 border-t border-[var(--border-subtle)] pt-4" aria-labelledby="planner-reminder-label">
                  <div>
                    <h3 id="planner-reminder-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Lembrete
                    </h3>
                    <div className="mt-2">
                      <select
                        id="planner-plan-reminder"
                        value={reminderOption}
                        onChange={(event) => setReminderOption(event.target.value as ReminderOption)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                      >
                        {REMINDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>
              )}
            </section>
          ) : recurringOccurrence ? (
            <p className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <Repeat size={14} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
              {plan?.repeatType === "weekly" ? "Plano semanal" : "Ocorrência de uma série"}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingScope)}
        onClose={() => setPendingScope(null)}
        title="Aplicar alterações da série?"
        description="Escolha onde as alterações deste plano recorrente serão aplicadas."
        panelClassName="max-w-[400px]"
        zIndex={1010}
        footer={
          <Button type="button" variant="ghost" disabled={loading} onClick={() => setPendingScope(null)} className="ml-auto">
            Cancelar
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" loading={loading} disabled={loading} onClick={() => pendingScope && void save(pendingScope, "occurrence")}>
            Apenas este dia
          </Button>
          <Button type="button" loading={loading} disabled={loading} onClick={() => pendingScope && void save(pendingScope, "series")}>
            Todos os dias da série
          </Button>
          {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
