import pool from "../db";
import type { User } from "@/types";
import { NotFoundError } from "../errors";
import { parseProfileId, parseTitle } from "./validation";

interface ProfileRow {
  id: string;
  display_name: string;
  email: string | null;
  created_at: Date | string;
}

function mapToUser(row: ProfileRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function ensureProfile(profileId: string, displayName?: string, email?: string): Promise<void> {
  parseProfileId(profileId);
  await pool.query(
    `insert into profiles (id, display_name, email)
     values ($1, $2, $3)
     on conflict (id) do update set
       display_name = coalesce(nullif(excluded.display_name, ''), profiles.display_name),
       email = coalesce(excluded.email, profiles.email)`,
    [profileId, displayName?.trim() ?? "", email ?? null],
  );
}

export async function getProfile(profileId: string): Promise<User> {
  parseProfileId(profileId);
  const result = await pool.query<ProfileRow>(
    `select id, display_name, email, created_at from profiles where id = $1`,
    [profileId],
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Perfil não encontrado.");
  }
  return mapToUser(result.rows[0]);
}

export async function upsertAndGetProfile(profileId: string, displayName?: string, email?: string): Promise<User> {
  await ensureProfile(profileId, displayName, email);
  return getProfile(profileId);
}

export async function updateDisplayName(profileId: string, displayName: string): Promise<User> {
  parseProfileId(profileId);
  const name = parseTitle(displayName, "Nome");
  const result = await pool.query<ProfileRow>(
    `update profiles set display_name = $2 where id = $1
     returning id, display_name, email, created_at`,
    [profileId, name],
  );
  if (!result.rows[0]) throw new NotFoundError("Perfil não encontrado.");
  return mapToUser(result.rows[0]);
}
