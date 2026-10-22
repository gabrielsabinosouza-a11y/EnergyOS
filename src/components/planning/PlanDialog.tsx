"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Repeat } from "lucide-react";
import type { Category, PlanEndType, PlanRepeatType, WeeklyPlanItem } from "@/types";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";
import { SHORT_WEEKDAYS, todayIso } from "@/lib/planning/dates";
import { recurrenceInitialDate, syncInitialWeekday, validateWeeklyRecurrence, weeklyRecurrenceSummary, type RecurrenceFormErrors } from "@/lib/planning/recurrence-form";
import { formatTimeInput, isValidTime24 } from "@/lib/planning/time";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { PlannerDatePicker } from "./PlannerDatePicker";

type RepeatScope = "occurrence" | "series";
type ReminderOption = "sem-lembrete" | "no-horario" | "5-min" | "10-min" | "30-min" | "1-hora";
type PlanFormValues = {
  /**
   * Data do plano.
   * `null` = sem data (tarefa não agendada) / limpar a data.
   * `undefined` = não mexer na data.
   */
  planDate?: string | null;
  title: string;
  categoryId?: number;
  startTime: string | null;
  endTime: string | null;
  repeatType: PlanRepeatType;
  repeatDays: number[];
  repeatEndType: PlanEndType;
  repeatEndCount: number | null;
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
  initialDate?: string | null;
  selectedDate?: string | null;
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
  selectedDate,
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
  const [repeatChanged, setRepeatChanged] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatDaysTouched, setRepeatDaysTouched] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState<string | null>(null);
  const [hasRepeatEnd, setHasRepeatEnd] = useState(false);
  const [repeatEndType, setRepeatEndType] = useState<PlanEndType>("never");
  const [repeatEndCount, setRepeatEndCount] = useState("");
  const [reminderOption, setReminderOption] = useState<ReminderOption>("sem-lembrete");
  const [pendingScope, setPendingScope] = useState<PlanFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recurrenceErrors, setRecurrenceErrors] = useState<RecurrenceFormErrors>({});
  const [touchedFields, setTouchedFields] = useState({ planDate: false, repeatDays: false, repeatUntil: false, repeatCount: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const repeatDaysRef = useRef<HTMLDivElement>(null);
  const repeatUntilRef = useRef<HTMLDivElement>(null);

  // Reset form state when modal opens or plan changes
  const wasOpenRef = useRef(false);
  useEffect(() => {
    // Só reseta na ABERTURA do diálogo. Se reexecutasse a cada mudança de
    // `plan` (o objeto vem do estado e muda de identidade a cada refetch),
    // o que o usuário já digitou seria apagado no meio da digitação.
    if (open && !wasOpenRef.current) {
      setTitle(plan?.title ?? "");
      setCategoryId(plan?.categoryId?.toString() ?? "");
      const nextDate = plan
        ? plan.seriesId !== null ? plan.seriesStartDate ?? plan.planDate ?? null : plan.planDate ?? null
        : recurrenceInitialDate(initialDate, selectedDate, todayIso());
      setPlanDate(nextDate);
      setStartTime(plan?.startTime?.slice(0, 5) ?? initialStartTime ?? null);
      setEndTime(initialEndTime ?? (plan ? plan.endTime?.slice(0, 5) ?? null : null));
      const nextRepeatType = plan?.repeatType === "weekly";
      setRepeatWeekly(nextRepeatType);
      setRepeatChanged(false);
      setRepeatDays(nextRepeatType ? plan?.repeatDays ?? [] : !plan && nextDate ? syncInitialWeekday(nextDate) : []);
      setRepeatDaysTouched(false);
      setRepeatUntil(plan?.repeatEndDate ?? "");
      const nextEndType = plan?.repeatEndType ?? "never";
      setRepeatEndType(nextEndType);
      setRepeatEndCount(plan?.repeatEndCount ? String(plan.repeatEndCount) : "");
      setHasRepeatEnd(nextEndType === "date");
      const offset = plan?.reminderOffsetMin;
      const found = REMINDER_OPTIONS.find((opt) => opt.offsetMin === offset);
      setReminderOption(found?.value ?? "sem-lembrete");
      setError("");
      setRecurrenceErrors({});
      setTouchedFields({ planDate: false, repeatDays: false, repeatUntil: false, repeatCount: false });
      setSubmitAttempted(false);
    }
    wasOpenRef.current = open;
  }, [open, plan, initialDate, selectedDate, initialStartTime, initialEndTime]);

  const recurringOccurrence = plan?.seriesId !== null && plan?.seriesId !== undefined;
  const preservingInterval = recurringOccurrence && plan?.repeatType === "interval" && !repeatChanged;


  /** Categoria efetiva: a escolhida pelo usuário ou a primeira disponível. */
  const selectedCategoryId = categoryId || String(plan?.categoryId ?? categories[0]?.id ?? "");

  function recurrenceValidation(startDate: string | null, days: number[], endDate: string | null, endType = repeatEndType, endCount = repeatEndCount) {
    return validateWeeklyRecurrence({
      startDate,
      days,
      hasEndDate: endType === "date",
      endDate,
      hasEndCount: endType === "count",
      endCount,
    });
  }

  function handleDateChange(date: string | null) {
    setPlanDate(date);
    if (date && !repeatDaysTouched) setRepeatDays(syncInitialWeekday(date));
    if (Object.values(touchedFields).some(Boolean) || submitAttempted) setRecurrenceErrors(recurrenceValidation(date, date && !repeatDaysTouched ? syncInitialWeekday(date) : repeatDays, repeatUntil));
  }

  function handleRepeatChange(weekly: boolean) {
    setRepeatChanged(true);
    setRepeatWeekly(weekly);
    if (!weekly) setRecurrenceErrors({});
    // A repetição semanal usa a data como âncora: só pré-seleciona o dia
    // da semana quando já existe uma data escolhida.
    if (weekly && repeatDays.length === 0 && planDate) setRepeatDays(syncInitialWeekday(planDate));
  }

  function toggleRepeatDay(day: number) {
    setRepeatDaysTouched(true);
    const nextDays = repeatDays.includes(day)
      ? repeatDays.filter((selected) => selected !== day)
      : [...repeatDays, day].sort((a, b) => (a + 6) % 7 - (b + 6) % 7);
    setRepeatDays(nextDays);
    if (Object.values(touchedFields).some(Boolean) || submitAttempted) setRecurrenceErrors(recurrenceValidation(planDate, nextDays, repeatUntil));
  }

  function touchRecurrenceField(field: keyof RecurrenceFormErrors) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
    if (repeatWeekly) setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, repeatUntil));
  }

  const selectedReminderOffset = REMINDER_OPTIONS.find((opt) => opt.value === reminderOption)?.offsetMin ?? null;
  const needsPermission = selectedReminderOffset != null;
  const recurrenceErrorSummary = repeatWeekly ? Object.values(recurrenceErrors).filter(Boolean).join(" ") : "";
  const recurrenceSummary = planDate
    ? weeklyRecurrenceSummary(planDate, repeatDays, repeatEndType === "date" ? repeatUntil : null, repeatEndType === "date")
      .replace(/sem data final\.$/, repeatEndType === "count" ? `após ${repeatEndCount || "…"} ocorrências.` : "sem data final.")
    : "";

  function validate(): PlanFormValues | null {
    setSubmitAttempted(true);
    const nextRecurrenceErrors = repeatWeekly
      ? recurrenceValidation(planDate, repeatDays, repeatUntil)
      : {};
    setRecurrenceErrors(nextRecurrenceErrors);
    if (Object.keys(nextRecurrenceErrors).length > 0) {
      const firstInvalid = nextRecurrenceErrors.planDate ? dateFieldRef : nextRecurrenceErrors.repeatDays ? repeatDaysRef : repeatUntilRef;
      window.requestAnimationFrame(() => {
        firstInvalid.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.current?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
      });
      setError("");
      return null;
    }
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
    setError("");
    return {
      // null = sem data (tarefa não agendada). O corpo da API trata
      // "null" como limpar a data e "undefined" como "não mexer".
      planDate: planDate ?? null,
      title: trimmedTitle,
      categoryId: recurringOccurrence
        ? plan!.categoryId
        : selectedCategoryId ? parsedCategoryId : undefined,
      startTime: startTime || null,
      endTime: recurringOccurrence ? null : endTime || null,
      repeatType: recurringOccurrence && plan?.repeatType === "interval" && !repeatChanged
        ? "interval"
        : repeatWeekly ? "weekly" : "once",
      repeatDays: repeatWeekly ? repeatDays : recurringOccurrence && plan?.repeatType === "interval" && !repeatChanged ? plan.repeatDays ?? [] : [],
      repeatEndType: repeatWeekly || preservingInterval ? repeatEndType : "never",
      repeatEndCount: (repeatWeekly || preservingInterval) && repeatEndType === "count" ? Number(repeatEndCount) : null,
      repeatUntil: (repeatWeekly || preservingInterval) && repeatEndType === "date" ? repeatUntil : null,
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
          <div className="w-full">
            {submitAttempted && recurrenceErrorSummary ? <p className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="status" aria-live="polite">Revise os campos da repetição: {recurrenceErrorSummary}</p> : null}
            {error ? <p className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">{error}</p> : null}
            <div className="flex items-center gap-2">
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
            </div>
          </div>
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
            <label htmlFor="planner-plan-date" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {repeatWeekly ? "Data inicial" : "Data"}
              {!repeatWeekly && <span className="rounded-full border border-[var(--border-subtle)] px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-[var(--text-faint)]">opcional</span>}
              {repeatWeekly && <span className="text-red-300" aria-hidden="true">*</span>}
            </label>
            <div ref={dateFieldRef} className="relative space-y-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) touchRecurrenceField("planDate"); }}>
              <PlannerDatePicker
                id="planner-plan-date"
                label={repeatWeekly ? "Data inicial" : "Data do plano"}
                value={planDate}
                onChange={handleDateChange}
                placeholder="Sem data"
                disabled={Boolean(recurringOccurrence)}
                aria-required={repeatWeekly}
                onBlur={() => touchRecurrenceField("planDate")}
                aria-invalid={repeatWeekly && Boolean(recurrenceErrors.planDate)}
                aria-describedby={repeatWeekly && recurrenceErrors.planDate ? "planner-plan-date-error" : undefined}
              />
              {repeatWeekly && recurrenceErrors.planDate && (touchedFields.planDate || submitAttempted) ? <p id="planner-plan-date-error" className="text-xs text-red-300" aria-live="polite">{recurrenceErrors.planDate}</p> : null}
            </div>
          </div>

          <div className={`grid gap-3 ${recurringOccurrence ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="space-y-1.5">
              <label htmlFor="planner-plan-start-time" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Início
                <span className="rounded-full border border-[var(--border-subtle)] px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-[var(--text-faint)]">
                  opcional
                </span>
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
                <label htmlFor="planner-plan-end-time" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Fim
                  <span className="rounded-full border border-[var(--border-subtle)] px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-[var(--text-faint)]">
                    opcional
                  </span>
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

          <>
            <section className="glass-section space-y-4 p-4" aria-labelledby="planner-repeat-label">
              <div>
                <h3 id="planner-repeat-label" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Repetir
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={!repeatWeekly && !preservingInterval}
                    onClick={() => handleRepeatChange(false)}
                    className="glass-segment px-3 py-2.5 text-sm font-medium"
                  >
                    Não repetir
                  </button>
                  <button
                    type="button"
                    aria-pressed={repeatWeekly && !preservingInterval}
                    onClick={() => handleRepeatChange(true)}
                    className="glass-segment flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium"
                  >
                    <Repeat size={14} aria-hidden="true" />
                    Semanalmente
                  </button>
                </div>
                {preservingInterval ? <p className="mt-2 text-xs text-[var(--text-muted)]">Regra atual: a cada {plan?.repeatInterval ?? 2} semanas. Escolha uma opção para substituí-la.</p> : null}
                {repeatWeekly ? <p className="mt-2 text-xs text-[var(--text-muted)]">A primeira ocorrência será no próximo dia selecionado a partir da data inicial.</p> : null}
              </div>

              {repeatWeekly ? (
                <>
                  <div ref={repeatDaysRef} className="space-y-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) touchRecurrenceField("repeatDays"); }}>
                  {/* Group validity belongs to the set of weekday toggles, not an individual day. */}
                  {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana" aria-invalid={Boolean(recurrenceErrors.repeatDays)} aria-describedby={recurrenceErrors.repeatDays ? "planner-repeat-days-error" : undefined}>
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
                  {recurrenceErrors.repeatDays && (touchedFields.repeatDays || submitAttempted) ? <p id="planner-repeat-days-error" className="text-xs text-red-300" aria-live="polite">{recurrenceErrors.repeatDays}</p> : null}
                  {recurrenceSummary && <p className="text-xs text-[var(--text-muted)]">{recurrenceSummary}</p>}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-[var(--text-secondary)]">Fim da repetição</legend>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="radio"
                        name="planner-repeat-end"
                        checked={repeatEndType === "never"}
                        onChange={() => { setRepeatEndType("never"); setHasRepeatEnd(false); setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, repeatUntil, "never")); }}
                        className="accent-[var(--accent)]"
                      />
                      Sem data final
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="radio"
                        name="planner-repeat-end"
                        checked={repeatEndType === "date"}
                        onChange={() => { setRepeatEndType("date"); setHasRepeatEnd(true); setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, repeatUntil, "date")); }}
                        className="accent-[var(--accent)]"
                      />
                      Repetir até
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input
                        type="radio"
                        name="planner-repeat-end"
                        checked={repeatEndType === "count"}
                        onChange={() => { setRepeatEndType("count"); setHasRepeatEnd(false); setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, repeatUntil, "count")); }}
                        className="accent-[var(--accent)]"
                      />
                      Após ocorrências
                    </label>
                    {hasRepeatEnd ? (
                      <div ref={repeatUntilRef} className="space-y-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) touchRecurrenceField("repeatUntil"); }}>
                      <PlannerDatePicker
                        id="planner-repeat-until"
                        label="Repetir até"
                        value={repeatUntil}
                        onChange={(date) => {
                          setRepeatUntil(date);
                          if (Object.values(touchedFields).some(Boolean) || submitAttempted) setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, date, "date"));
                        }}
                        onBlur={() => touchRecurrenceField("repeatUntil")}
                        aria-invalid={Boolean(recurrenceErrors.repeatUntil)}
                        aria-describedby={recurrenceErrors.repeatUntil ? "planner-repeat-until-error" : undefined}
                        placeholder="Escolha a data final"
                      />
                      {recurrenceErrors.repeatUntil && (touchedFields.repeatUntil || submitAttempted) ? <p id="planner-repeat-until-error" className="text-xs text-red-300" aria-live="polite">{recurrenceErrors.repeatUntil}</p> : null}
                      </div>
                    ) : null}
                    {repeatEndType === "count" ? (
                      <div ref={repeatUntilRef} className="space-y-1">
                        <label htmlFor="planner-repeat-count" className="sr-only">Quantidade de ocorrências</label>
                        <input
                          id="planner-repeat-count"
                          type="number"
                          min={1}
                          max={10000}
                          value={repeatEndCount}
                          onChange={(event) => {
                            setRepeatEndCount(event.target.value);
                            if (Object.values(touchedFields).some(Boolean) || submitAttempted) setRecurrenceErrors(recurrenceValidation(planDate, repeatDays, repeatUntil, "count", event.target.value));
                          }}
                          onBlur={() => touchRecurrenceField("repeatCount")}
                          placeholder="Ex.: 12"
                          aria-invalid={Boolean(recurrenceErrors.repeatCount)}
                          aria-describedby={recurrenceErrors.repeatCount ? "planner-repeat-count-error" : undefined}
                          className="glass-field tabular-nums"
                        />
                        {recurrenceErrors.repeatCount && (touchedFields.repeatCount || submitAttempted) ? <p id="planner-repeat-count-error" className="text-xs text-red-300" aria-live="polite">{recurrenceErrors.repeatCount}</p> : null}
                      </div>
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
                    {selectedReminderOffset !== null && !startTime ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">Defina um horário de início para receber este lembrete.</p> : null}
                  </div>
                </section>
              )}
            </section>
          </>

        </form>
      </Modal>

      <Modal
        open={Boolean(pendingScope)}
        onClose={() => setPendingScope(null)}
        title="Aplicar alterações da série?"
        description="Escolha onde aplicar as alterações. Ajustes em Repetir só mudam quando você escolhe a série inteira."
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
            Apenas esta ocorrência
          </Button>
          <Button type="button" loading={loading} disabled={loading} className="glass-cta" onClick={() => pendingScope && void save(pendingScope, "series")}>
            Toda a série
          </Button>
          {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
