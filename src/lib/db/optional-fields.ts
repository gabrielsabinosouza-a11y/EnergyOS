import { parseDate, ValidationError } from "./validation";

/**
 * Campos opcionais dos formulários (unidade da meta, prazo, ...).
 * `""`, `null` e `undefined` são normalizados para `null` = "sem valor",
 * para que limpar um campo no formulário realmente limpe no banco.
 */
export function parseOptionalText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "") return null;
  if (text.length > 40) throw new ValidationError(`${label} muito longa (máx. 40).`);
  return text;
}

/** Data opcional (YYYY-MM-DD) em qualquer TZ do produto; "" / null = sem prazo. */
export function parseOptionalDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "") return null;
  return parseDate(text, label);
}