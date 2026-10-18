"use client";

import { useState } from "react";
import type { Category, WeeklyPlanItem } from "@/types";
import { PLAN_NAME_MAX } from "@/lib/daily-limits";
import { todayIso } from "@/lib/planning/dates";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

interface PlanDialogProps {
  open: boolean;
  plan?: WeeklyPlanItem | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  categories: Category[];
  onClose: () => void;
  onSave: (
    plan: WeeklyPlanItem | null,
    values: { planDate: string; title: string; categoryId?: number; startTime: string | null; endTime: string | null },
  ) => Promise<void>;
}

export function PlanDialog({
  open,
  plan,
  initialDate,
  initialStartTime,
  initialEndTime,
  categories,
  onClose,
  onSave,
}: PlanDialogProps) {
  const [title, setTitle] = useState(() => plan?.title ?? "");
  const [categoryId, setCategoryId] = useState(() => String(plan?.categoryId ?? categories[0]?.id ?? ""));
  const [planDate, setPlanDate] = useState(() => plan?.planDate ?? initialDate ?? todayIso());
  const [startTime, setStartTime] = useState(() => plan?.startTime?.slice(0, 5) ?? initialStartTime ?? (plan ? "" : "09:00"));
  const [endTime, setEndTime] = useState(() => plan?.endTime?.slice(0, 5) ?? initialEndTime ?? (plan ? "" : "10:00"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const recurringOccurrence = plan?.seriesId !== null && plan?.seriesId !== undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Informe o título do plano.");
      return;
    }
    if (trimmedTitle.length > PLAN_NAME_MAX) {
      setError(`Use até ${PLAN_NAME_MAX} caracteres.`);
      return;
    }
    const parsedCategoryId = Number(categoryId);
    if (!recurringOccurrence && categoryId && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      setError("Escolha uma categoria.");
      return;
    }
    if (startTime && endTime && !recurringOccurrence && endTime <= startTime) {
      setError("O horário de fim deve ser posterior ao início.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSave(plan ?? null, {
        planDate,
        title: trimmedTitle,
        categoryId: recurringOccurrence ? plan!.categoryId : categoryId ? parsedCategoryId : undefined,
        startTime: startTime || null,
        endTime: recurringOccurrence ? null : endTime || null,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o plano.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? "Editar plano" : "Novo plano"}
      description={recurringOccurrence
        ? "As alterações de título e início se aplicam somente a esta ocorrência."
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
            className="auth-input"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="planner-plan-category" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Categoria
          </label>
          <select
            id="planner-plan-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="auth-input"
            disabled={Boolean(recurringOccurrence)}
          >
            {!recurringOccurrence ? <option value="">Padrão</option> : null}
            {!categories.some((category) => String(category.id) === categoryId)
              ? <option value={categoryId}>{plan?.category.name ?? "Categoria atual"}</option>
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
          <input
            id="planner-plan-date"
            type="date"
            value={planDate}
            onChange={(event) => setPlanDate(event.target.value)}
            className="auth-input"
            disabled={Boolean(recurringOccurrence)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="planner-plan-start-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Início
            </label>
            <input
              id="planner-plan-start-time"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="auth-input"
            />
          </div>
          {!recurringOccurrence ? (
            <div className="space-y-1">
              <label htmlFor="planner-plan-end-time" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Fim
              </label>
              <input
                id="planner-plan-end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="auth-input"
              />
            </div>
          ) : null}
        </div>

        {recurringOccurrence ? (
          <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            A categoria e a data pertencem à série recorrente e não podem ser alteradas nesta ocorrência.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
