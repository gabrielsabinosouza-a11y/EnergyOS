import { createHash } from "node:crypto";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseDate(value: unknown, field: string, fallback?: string): string {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`${field} é obrigatório.`);
  }
  if (!isValidDateString(value)) throw new ValidationError(`${field} deve ser uma data YYYY-MM-DD válida.`);
  return value;
}

export function parseOptionalTime(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) throw new ValidationError(`${field} deve estar no formato HH:mm.`);
  return value.slice(0, 5);
}

export function parseProfileId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new ValidationError("Identificador de perfil inválido.");
  }
  if (UUID_PATTERN.test(value)) return value;

  const hash = createHash("sha256").update(`energyos:${value}`).digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

export function parseTitle(value: unknown, field = "Título"): string {
  if (typeof value !== "string") throw new ValidationError(`${field} é obrigatório.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${field} é obrigatório.`);
  if (trimmed.length > 200) throw new ValidationError(`${field} deve ter no máximo 200 caracteres.`);
  return trimmed;
}

export function parseEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} inválido. Valores aceitos: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function parseNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; integer?: boolean; fallback?: number } = {},
): number {
  const { min, max, integer, fallback } = options;
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`${field} é obrigatório.`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ValidationError(`${field} deve ser um número.`);
  if (integer && !Number.isInteger(parsed)) throw new ValidationError(`${field} deve ser um número inteiro.`);
  if (min !== undefined && parsed < min) throw new ValidationError(`${field} deve ser maior ou igual a ${min}.`);
  if (max !== undefined && parsed > max) throw new ValidationError(`${field} deve ser menor ou igual a ${max}.`);
  return parsed;
}

export function parseBoolean(value: unknown, field: string, fallback?: boolean): boolean {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`${field} é obrigatório.`);
  }
  if (typeof value !== "boolean") throw new ValidationError(`${field} deve ser verdadeiro ou falso.`);
  return value;
}

export function assertObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("Corpo da requisição inválido.");
  }
  return value as Record<string, unknown>;
}
