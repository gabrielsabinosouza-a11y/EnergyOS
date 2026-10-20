"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Repeat } from "lucide-react";
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
  planDate?: string;
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
  // State for form fields
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatDaysTouched, setRepeatDaysTouched] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [hasRepeatEnd, setHasRepeatEnd] = useState(false);
  const [reminderOption, setReminderOption] = useState<ReminderOption>("sem-lembrete");
  const [pendingScope, setPendingScope] = useState<PlanFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form state when modal opens or plan changes
  useEffect(() => {
    if (open) {
      setTitle(plan?.title ?? "");
      setCategoryId(plan?.categoryId?.toString() ?? "");
      setPlanDate(plan?.planDate ?? initialDate ?? null);
      setStartTime(plan?.startTime?.slice(0, 5) ?? initialStartTime ?? null);
      setEndTime(initialEndTime ?? (plan ? plan.endTime?.slice(0, 5) ?? null : null));
      setRepeatWeekly(false);
      setRepeatDays([]);
      setRepeatDaysTouched(false);
      setRepeatUntil("");
      setHasRepeatEnd(false);
      const offset = plan?.reminderOffsetMin;
      const found = REMINDER_OPTIONS.find((opt) => opt.offsetMin === offset);
      setReminderOption(found?.value ?? "sem-lembrete");
      setError("");
    }
  }, [open, plan, initialDate, initialStartTime, initialEndTime]);

  const recurringOccurrence = plan?.seriesId !== null && plan?.seriesId !== undefined;


  /** Categoria efetiva: a escolhida pelo usuário ou a primeira disponível. */
  const selectedCategoryId = categoryId || String(plan?.categoryId ?? categories[0]?.id ?? "");

  function handleDateChange(date: string | null) {
    setPlanDate(date);
    if (date && !repeatDaysTouched) setRepeatDays([weekdayOfIso(date)]);
  }

  function handleRepeatChange(weekly: boolean) {
    setRepeatWeekly(weekly);
    // A repetição semanal usa a data como âncora: só pré-seleciona o dia
    // da semana quando já existe uma data escolhida.
    if (weekly && repeatDays.length === 0 && planDate) setRepeatDays([weekdayOfIso(planDate)]);
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
    if (repeatWeekly && !planDate) {
      setError("Selecione uma data inicial para a repetição semanal.");
      return null;
    }
    if (repeatWeekly && hasRepeatEnd && repeatUntil && planDate && repeatUntil < planDate) {
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

  // Callback estável para o Modal: evita que o efeito interno do diálogo
  // (foco/teclado) seja reexecutado a cada tecla digitada.
  const handleClose = useCallback(() => {
    if (pendingScope) setPendingScope(null);
    else onClose();
  }, [onClose, pendingScope]);

  const handleCancel = useCallback(() => {
    if (pendingScope) setPendingScope(null);
    else onClose();
  }, [onClose, pendingScope]);

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={plan ? "Editar plano" : "Novo plano"}
        description={recurringOccurrence
          ? "Escolha se as alterações serão aplicadas a esta ocorrência ou à série."
          : "Defina título e categoria. Data e horário são opcionais."}
        variant="center"
        surface="glass"
        panelClassName="planner-glass-modal max-w-[520px]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading} className="ml-auto">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="planner-plan-form"
              loading={loading}
              disabled={loading}
              className="glass-cta"
            >
              {plan ? "Salvar alterações" : "Criar plano"}
            </Button>
          </>
        }
      >
        <form id="planner-plan-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
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
              className="glass-field"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="planner-plan-category" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Categoria
            </label>
            <select
              id="planner-plan-category"
              value={selectedCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="glass-field"
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

          <div className="space-y-1.5">
            <label htmlFor="planner-plan-date" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Data
            </label>
            <div className="relative">
              <PlannerDatePicker
                id="planner-plan-date"
                label="Data do plano"
                value={planDate}
                onChange={handleDateChange}
                placeholder="Sem data"
                disabled={Boolean(recurringOccurrence)}
              />
            </div>
          </div>

          <div className={`grid gap-3 ${recurringOccurrence ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="space-y-1.5">
              <label htmlFor="planner-plan-start-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Início
              </label>
              <input
                id="planner-plan-start-time"
                type="text"
                inputMode="numeric"
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                maxLength={5}
                value={startTime ?? ""}
                onChange={(event) => setStartTime(formatTimeInput(event.target.value) || null)}
                placeholder="Sem horário"
                aria-label="Horário de início, formato 24 horas"
                className="glass-field tabular-nums"
              />
            </div>
            {!recurringOccurrence ? (
              <div className="space-y-1.5">
                <label htmlFor="planner-plan-end-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Fim
                </label>
                <input
                  id="planner-plan-end-time"
                  type="text"
                  inputMode="numeric"
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  maxLength={5}
                  value={endTime ?? ""}
                  onChange={(event) => setEndTime(formatTimeInput(event.target.value) || null)}
                  placeholder="Sem horário"
                  aria-label="Horário de fim, formato 24 horas"
                  className="glass-field tabular-nums"
                />
              </div>
            ) : null}
          </div>

          {!plan ? (
            <section className="glass-section space-y-4 p-4" aria-labelledby="planner-repeat-label">
              <div>
                <h3 id="planner-repeat-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Repetir
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={!repeatWeekly}
                    onClick={() => handleRepeatChange(false)}
                    className="glass-segment px-3 py-2.5 text-sm font-medium"
                  >
                    Não repetir
                  </button>
                  <button
                    type="button"
                    aria-pressed={repeatWeekly}
                    onClick={() => handleRepeatChange(true)}
                    className="glass-segment flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium"
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
                          className="glass-chip min-w-10 px-2.5 py-1.5 text-xs font-semibold"
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
                <section className="space-y-2.5 border-t border-[var(--glass-border)] pt-4" aria-labelledby="planner-reminder-label">
                  <div>
                    <h3 id="planner-reminder-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Lembrete
                    </h3>
                    <div className="mt-2.5">
                      <select
                        id="planner-plan-reminder"
                        value={reminderOption}
                        onChange={(event) => setReminderOption(event.target.value as ReminderOption)}
                        className="glass-field"
                      >
                        {REMINDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
                      <Bell size={12} aria-hidden="true" />
                      Aviso local no dispositivo — não altera a recompensa do plano.
                    </p>
                  </div>
                </section>
              )}
            </section>
          ) : recurringOccurrence ? (
            <p className="glass-section flex items-center gap-2 px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
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
        surface="glass"
        panelClassName="planner-glass-modal max-w-[420px]"
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
          <Button type="button" loading={loading} disabled={loading} className="glass-cta" onClick={() => pendingScope && void save(pendingScope, "series")}>
            Todos os dias da série
          </Button>
          {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
