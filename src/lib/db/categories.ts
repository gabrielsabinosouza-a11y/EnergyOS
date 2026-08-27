import pool from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { parseProfileId, ValidationError } from "./validation";
import { CATEGORY_ICON_OPTIONS, FALLBACK_CATEGORY_NAME } from "@/lib/categories";
import type { Category } from "@/types";

/**
 * Sistema unificado de categorias (metas, tarefas, Kanban, plano semanal).
 * Categorias com user_id null são padrões do sistema; as demais pertencem ao usuário.
 */

const NAME_MAX = 20;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const CATEGORY_COLUMNS = `id, user_id, name, color, icon, is_custom, created_at`;

interface CategoryRow {
  id: string | number;
  user_id: string | null;
  name: string;
  color: string;
  icon: string | null;
  is_custom: boolean;
  created_at: Date | string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: Number(row.id),
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isCustom: row.is_custom,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

function assertName(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("Nome da categoria é obrigatório.");
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError("Nome da categoria é obrigatório.");
  if (trimmed.length > NAME_MAX) throw new ValidationError(`Nome da categoria deve ter no máximo ${NAME_MAX} caracteres.`);
  return trimmed;
}

function assertColor(value: unknown): string {
  if (typeof value !== "string" || !COLOR_PATTERN.test(value)) throw new ValidationError("Escolha uma cor para a categoria.");
  return value.toLowerCase();
}

const CATEGORY_ICON_VALUE_SET = new Set(CATEGORY_ICON_OPTIONS.map((o) => o.value));

function assertIcon(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !CATEGORY_ICON_VALUE_SET.has(value)) throw new ValidationError("Ícone inválido.");
  return value;
}

function assertCategoryId(categoryId: number): void {
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw new ValidationError("Categoria inválida.");
}

/** Categorias visíveis para o usuário (padrões do sistema + as dele), padrões primeiro. */
export async function listCategories(profileId: string): Promise<Category[]> {
  parseProfileId(profileId);
  const result = await pool.query<CategoryRow>(
    `select ${CATEGORY_COLUMNS}
     from categories
     where user_id is null or user_id = $1
     order by (user_id is null) desc, lower(name)`,
    [profileId],
  );
  return result.rows.map(mapCategory);
}

/** Procura por nome entre as categorias visíveis para o usuário (padrões + dele). */
async function findVisibleByName(profileId: string, name: string, excludeId?: number): Promise<CategoryRow | undefined> {
  const result = await pool.query<CategoryRow>(
    `select ${CATEGORY_COLUMNS}
     from categories
     where (user_id is null or user_id = $1)
       and lower(name) = lower($2)
       and ($3::bigint is null or id != $3)`,
    [profileId, name, excludeId ?? null],
  );
  return result.rows[0];
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon?: string | null;
}

export async function createCategory(profileId: string, input: CreateCategoryInput): Promise<Category> {
  parseProfileId(profileId);
  const name = assertName(input.name);
  const color = assertColor(input.color);
  const icon = assertIcon(input.icon);

  if (await findVisibleByName(profileId, name)) {
    throw new ConflictError("Você já tem uma categoria com esse nome.");
  }

  const result = await pool.query<CategoryRow>(
    `insert into categories (user_id, name, color, icon, is_custom)
     values ($1, $2, $3, $4, true)
     returning ${CATEGORY_COLUMNS}`,
    [profileId, name, color, icon],
  );
  return mapCategory(result.rows[0]);
}

export interface UpdateCategoryPatch {
  name?: string;
  color?: string;
  icon?: string | null;
}

export async function updateCategory(profileId: string, categoryId: number, patch: UpdateCategoryPatch): Promise<Category> {
  parseProfileId(profileId);
  assertCategoryId(categoryId);

  const existing = await pool.query<CategoryRow>(
    `select ${CATEGORY_COLUMNS} from categories where id = $1`,
    [categoryId],
  );
  const row = existing.rows[0];
  if (!row || row.user_id !== profileId) throw new NotFoundError("Categoria não encontrada.");
  if (!row.is_custom) throw new ValidationError("Categorias padrão não podem ser editadas.");

  const name = patch.name !== undefined ? assertName(patch.name) : row.name;
  const color = patch.color !== undefined ? assertColor(patch.color) : row.color;
  const icon = patch.icon !== undefined ? assertIcon(patch.icon) : row.icon;

  if (await findVisibleByName(profileId, name, categoryId)) {
    throw new ConflictError("Você já tem uma categoria com esse nome.");
  }

  const result = await pool.query<CategoryRow>(
    `update categories set name = $1, color = $2, icon = $3
     where id = $4 and user_id = $5
     returning ${CATEGORY_COLUMNS}`,
    [name, color, icon, categoryId, profileId],
  );
  return mapCategory(result.rows[0]);
}

/** Id da categoria padrão "Outros" (destino de reatribuição ao excluir). */
export async function resolveDefaultCategoryId(): Promise<number> {
  const result = await pool.query<{ id: string | number }>(
    `select id from categories where user_id is null and name = $1`,
    [FALLBACK_CATEGORY_NAME],
  );
  if (!result.rows[0]) throw new Error("Categoria padrão 'Outros' não encontrada. Execute: npm run db:init");
  return Number(result.rows[0].id);
}

/** Valida que a categoria existe e é visível para o perfil (padrão ou própria). */
export async function assertCategoryForProfile(profileId: string, categoryId: number): Promise<number> {
  parseProfileId(profileId);
  assertCategoryId(categoryId);
  const result = await pool.query(
    `select 1 from categories where id = $1 and (user_id is null or user_id = $2)`,
    [categoryId, profileId],
  );
  if (!result.rows[0]) throw new NotFoundError("Categoria não encontrada.");
  return categoryId;
}

export interface DeleteCategoryResult {
  affected: number;
}

/**
 * Exclui uma categoria personalizada do usuário e reatribui metas, tarefas,
 * cards do Kanban e planos semanais para a categoria padrão "Outros".
 */
export async function deleteCategory(profileId: string, categoryId: number): Promise<DeleteCategoryResult> {
  parseProfileId(profileId);
  assertCategoryId(categoryId);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const existing = await client.query<CategoryRow>(
      `select ${CATEGORY_COLUMNS} from categories where id = $1 for update`,
      [categoryId],
    );
    const row = existing.rows[0];
    if (!row || row.user_id !== profileId) throw new NotFoundError("Categoria não encontrada.");
    if (!row.is_custom) throw new ValidationError("Categorias padrão não podem ser excluídas.");

    const fallbackId = await resolveDefaultCategoryId();

    let affected = 0;
    for (const table of ["goals", "tasks", "kanban_tasks", "weekly_plans"]) {
      const reassigned = await client.query(
        `update ${table} set category_id = $1 where category_id = $2`,
        [fallbackId, categoryId],
      );
      affected += reassigned.rowCount ?? 0;
    }

    await client.query(`delete from categories where id = $1 and user_id = $2`, [categoryId, profileId]);
    await client.query("commit");
    return { affected };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
