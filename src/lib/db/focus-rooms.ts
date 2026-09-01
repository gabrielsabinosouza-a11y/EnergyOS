import pool from "../db";
import { NotFoundError, ConflictError, ForbiddenError } from "../errors";
import { ValidationError, parseProfileId } from "./validation";
import { recordMissionProgress } from "./daily-quests";
import { todayIso } from "./dates";
import { plantGardenEntries, getEnergyReward } from "./focus";

// Types matching the database schema
export type RoomStatus = "waiting" | "active" | "paused" | "completed" | "expired";
export type ParticipantSessionStatus = "waiting" | "focusing" | "completed" | "left";

export interface FocusRoomRow {
  id: string | number;
  code: string;
  host_profile_id: string;
  status: RoomStatus;
  duration_minutes: number;
  energy_type: string | null;
  created_at: Date | string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  elapsed_seconds: number;
  last_resumed_at: Date | string | null;
}

export interface RoomParticipantRow {
  id: string | number;
  room_id: string | number;
  profile_id: string;
  joined_at: Date | string;
  session_status: ParticipantSessionStatus;
  selected_energy_type: string | null;
  completed_at: Date | string | null;
  gave_up_at: Date | string | null;
}

export interface FocusRoom {
  id: number;
  code: string;
  hostProfileId: string;
  host?: { id: string; displayName: string; photoUrl?: string };
  status: RoomStatus;
  durationMinutes: number;
  energyType: string | null;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  elapsedSeconds: number;
  lastResumedAt?: string;
  participants: RoomParticipant[];
}

export interface RoomParticipant {
  id: number;
  profileId: string;
  profile?: { id: string; displayName: string; photoUrl?: string };
  joinedAt: string;
  sessionStatus: ParticipantSessionStatus;
  selectedEnergyType: string | null;
  completedAt?: string;
  gaveUpAt?: string;
}

// Helper to map database row to domain object
function mapFocusRoom(row: FocusRoomRow, participants: RoomParticipant[] = []): FocusRoom {
  return {
    id: Number(row.id),
    code: row.code,
    hostProfileId: row.host_profile_id,
    status: row.status,
    durationMinutes: row.duration_minutes,
    energyType: row.energy_type ?? null,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    startedAt: row.started_at ? (typeof row.started_at === "string" ? row.started_at : row.started_at.toISOString()) : undefined,
    endedAt: row.ended_at ? (typeof row.ended_at === "string" ? row.ended_at : row.ended_at.toISOString()) : undefined,
    elapsedSeconds: row.elapsed_seconds,
    lastResumedAt: row.last_resumed_at ? (typeof row.last_resumed_at === "string" ? row.last_resumed_at : row.last_resumed_at.toISOString()) : undefined,
    participants,
  };
}

function mapRoomParticipant(row: RoomParticipantRow, profile?: { id: string; displayName: string; photoUrl?: string }): RoomParticipant {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    profile,
    joinedAt: typeof row.joined_at === "string" ? row.joined_at : row.joined_at.toISOString(),
    sessionStatus: row.session_status,
    selectedEnergyType: row.selected_energy_type ?? null,
    completedAt: row.completed_at ? (typeof row.completed_at === "string" ? row.completed_at : row.completed_at.toISOString()) : undefined,
    gaveUpAt: row.gave_up_at ? (typeof row.gave_up_at === "string" ? row.gave_up_at : row.gave_up_at.toISOString()) : undefined,
  };
}

// Generate a unique 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if a room code already exists
export async function roomCodeExists(code: string): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    `select count(*)::int as count from focus_rooms where code = $1`,
    [code]
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

// Create a new focus room
export async function createFocusRoom(
  hostProfileId: string,
  durationMinutes: number,
  energyType?: string
): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  if (!hostProfileId) throw new ValidationError("Host profile ID is required");
  if (durationMinutes <= 0) throw new ValidationError("Duration must be positive");

  // Generate a unique code
  let code = generateRoomCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (await roomCodeExists(code) && attempts < maxAttempts) {
    code = generateRoomCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new ConflictError("Failed to generate a unique room code");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<FocusRoomRow>(
      `insert into focus_rooms (code, host_profile_id, status, duration_minutes, energy_type)
       values ($1, $2, $3, $4, $5)
       returning id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at, elapsed_seconds, last_resumed_at`,
      [code, hostProfileId, "waiting", durationMinutes, energyType ?? null]
    );

    // Add host as first participant
    await client.query<RoomParticipantRow>(
      `insert into room_participants (room_id, profile_id, session_status, selected_energy_type)
       values ($1, $2, $3, $4)`,
      [result.rows[0].id, hostProfileId, "waiting", energyType ?? null]
    );

    await client.query("commit");

    // Fetch the created room with participants
    const room = await getFocusRoomById(hostProfileId, Number(result.rows[0].id));
    return room!;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Get a focus room by ID
export async function getFocusRoomById(profileId: string, roomId: number): Promise<FocusRoom | null> {
  const parsedProfileId = parseProfileId(profileId);
  
  const result = await pool.query<FocusRoomRow>(
    `select id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at, elapsed_seconds, last_resumed_at
     from focus_rooms where id = $1`,
    [roomId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  
  // Authorization check: user must be the host or a participant
  if (row.host_profile_id !== parsedProfileId) {
    const participants = await getRoomParticipants(roomId);
    const isParticipant = participants.some((p) => p.profileId === parsedProfileId);
    if (!isParticipant) {
      throw new ForbiddenError("Você não tem permissão para acessar esta sala.");
    }
  }

  const participants = await getRoomParticipants(roomId);
  return mapFocusRoom(row, participants);
}

// Get a focus room by code
export async function getFocusRoomByCode(profileId: string, code: string): Promise<FocusRoom | null> {
  const parsedProfileId = parseProfileId(profileId);
  
  const result = await pool.query<FocusRoomRow>(
    `select id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at, elapsed_seconds, last_resumed_at
     from focus_rooms where code = $1`,
    [code]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  
  // Authorization check: user must be the host or a participant
  if (row.host_profile_id !== parsedProfileId) {
    const participants = await getRoomParticipants(Number(row.id));
    const isParticipant = participants.some((p) => p.profileId === parsedProfileId);
    if (!isParticipant) {
      throw new ForbiddenError("Você não tem permissão para acessar esta sala.");
    }
  }

  const participants = await getRoomParticipants(Number(row.id));
  return mapFocusRoom(row, participants);
}

// Get all room participants
export async function getRoomParticipants(roomId: number): Promise<RoomParticipant[]> {
  const result = await pool.query<RoomParticipantRow & { display_name: string; photo_url: string | null }>(
    `select 
       rp.id, rp.room_id, rp.profile_id, rp.joined_at, rp.session_status, rp.selected_energy_type, rp.completed_at, rp.gave_up_at,
       p.display_name, p.photo_url
     from room_participants rp
     left join profiles p on rp.profile_id = p.id
     where rp.room_id = $1
     order by rp.joined_at`,
    [roomId]
  );

  return result.rows.map((row) =>
    mapRoomParticipant(row, row.display_name ? { id: row.profile_id, displayName: row.display_name, photoUrl: row.photo_url ?? undefined } : undefined)
  );
}

// Update a participant's selected energy type
export async function updateParticipantEnergyType(roomId: number, profileId: string, energyType: string): Promise<RoomParticipant> {
  parseProfileId(profileId);
  
  const result = await pool.query<RoomParticipantRow>(
    `update room_participants 
     set selected_energy_type = $1 
     where room_id = $2 and profile_id = $3 
     returning id, room_id, profile_id, joined_at, session_status, selected_energy_type, completed_at, gave_up_at`,
    [energyType, roomId, profileId]
  );

  if (!result.rows[0]) {
    throw new NotFoundError("Participant not found");
  }

  return mapRoomParticipant(result.rows[0]);
}

// Update the room's duration (host only)
export async function updateRoomDuration(roomId: number, hostProfileId: string, durationMinutes: number): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  if (durationMinutes <= 0) throw new ValidationError("Duration must be positive");

  // Verify host
  const room = await pool.query<{ host_profile_id: string }>(
    `select host_profile_id from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new ForbiddenError("Only the host can update the room duration");
  }

  const result = await pool.query<FocusRoomRow>(
    `update focus_rooms set duration_minutes = $1 where id = $2 returning *`,
    [durationMinutes, roomId]
  );

  const participants = await getRoomParticipants(roomId);
  return mapFocusRoom(result.rows[0], participants);
}

// Add a participant to a room (idempotent).
// Re-joining a room the user is already in (e.g. the host, or a duplicate
// join) returns the existing participant instead of throwing, and refreshes
// their selected energy type if one was provided.
export async function addParticipantToRoom(roomId: number, profileId: string, selectedEnergyType?: string): Promise<RoomParticipant> {
  parseProfileId(profileId);
  
  // Check room status
  const room = await pool.query<{ status: string }>(
    `select status from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  if (room.rows[0].status !== "waiting") {
    throw new ConflictError("Cannot join a room that has already started or completed");
  }

  // Upsert: if the user is already a participant, just update their selected
  // energy type and return the existing row (relies on the
  // room_participants_room_id_profile_id_key unique constraint).
  const result = await pool.query<RoomParticipantRow>(
    `insert into room_participants (room_id, profile_id, session_status, selected_energy_type)
     values ($1, $2, $3, $4)
     on conflict (room_id, profile_id)
     do update set selected_energy_type = coalesce(excluded.selected_energy_type, room_participants.selected_energy_type)
     returning id, room_id, profile_id, joined_at, session_status, selected_energy_type, completed_at, gave_up_at`,
    [roomId, profileId, "waiting", selectedEnergyType ?? null]
  );

  return mapRoomParticipant(result.rows[0]);
}

// Remove a participant from a room
export async function removeParticipantFromRoom(roomId: number, profileId: string): Promise<void> {
  parseProfileId(profileId);
  
  await pool.query(
    `delete from room_participants where room_id = $1 and profile_id = $2`,
    [roomId, profileId]
  );
}

// Start a focus room (host only)
export async function startFocusRoom(roomId: number, hostProfileId: string): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  
  // Verify host
  const room = await pool.query<{ host_profile_id: string; status: string }>(
    `select host_profile_id, status from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new ForbiddenError("Only the host can start the room");
  }

  if (room.rows[0].status !== "waiting") {
    throw new ConflictError("Room is not in waiting state");
  }

  const now = new Date().toISOString();

  await pool.query(
    `update focus_rooms set status = 'active', started_at = $1, elapsed_seconds = 0, last_resumed_at = $1 where id = $2`,
    [now, roomId]
  );

  // Update all participants to focusing status
  await pool.query(
    `update room_participants set session_status = 'focusing' where room_id = $1`,
    [roomId]
  );

  // Fetch updated room
  const startedRoom = await getFocusRoomById(hostProfileId, roomId);
  return startedRoom!;
}

// Pause an active focus room (host only)
export async function pauseFocusRoom(roomId: number, hostProfileId: string): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  
  const room = await pool.query<{ host_profile_id: string; status: string; last_resumed_at: Date | string | null }>(
    `select host_profile_id, status, last_resumed_at from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new ForbiddenError("Only the host can pause the room");
  }

  if (room.rows[0].status !== "active") {
    throw new ConflictError("Room is not in an active state");
  }

  const now = Date.now();
  const lastResumed = room.rows[0].last_resumed_at
    ? new Date(
        typeof room.rows[0].last_resumed_at === "string"
          ? room.rows[0].last_resumed_at
          : room.rows[0].last_resumed_at.toISOString()
      ).getTime()
    : now;

  const currentSegment = Math.max(0, Math.round((now - lastResumed) / 1000));

  await pool.query(
    `update focus_rooms
       set status = 'paused',
           elapsed_seconds = elapsed_seconds + $1,
           last_resumed_at = null
     where id = $2`,
    [currentSegment, roomId]
  );

  const pausedRoom = await getFocusRoomById(hostProfileId, roomId);
  return pausedRoom!;
}

// Resume a paused focus room (host only)
export async function resumeFocusRoom(roomId: number, hostProfileId: string): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  
  const room = await pool.query<{ host_profile_id: string; status: string }>(
    `select host_profile_id, status from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new ForbiddenError("Only the host can resume the room");
  }

  if (room.rows[0].status !== "paused") {
    throw new ConflictError("Room is not paused");
  }

  const now = new Date().toISOString();

  await pool.query(
    `update focus_rooms set status = 'active', last_resumed_at = $1 where id = $2`,
    [now, roomId]
  );

  const resumedRoom = await getFocusRoomById(hostProfileId, roomId);
  return resumedRoom!;
}

// End a focus room
export async function endFocusRoom(roomId: number): Promise<FocusRoom> {
  const now = new Date().toISOString();

  await pool.query(
    `update focus_rooms set status = 'completed', ended_at = $1 where id = $2 and status in ('active', 'paused')`,
    [now, roomId]
  );

  // Update participants who are still focusing to completed
  await pool.query(
    `update room_participants 
     set session_status = 'completed', completed_at = $1
     where room_id = $2 and session_status = 'focusing'`,
    [now, roomId]
  );

  // Fetch room details - we need a profile_id to get the room
  const room = await pool.query<{ id: string | number; host_profile_id: string }>(
    `select id, host_profile_id from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new NotFoundError("Room not found");
  }

  const completedRoom = await getFocusRoomById(room.rows[0].host_profile_id, roomId);
  return completedRoom!;
}

// "Parar" (host only, verified by the route). This is a GIVE-UP action scoped
// to the HOST'S OWN energy/session outcome: it marks only the host as having
// left ("desistiu") so their energy becomes extinguished and they get no
// completion reward. It does NOT end the room for everyone — the shared room
// timer continues running for every other participant, who can therefore still
// complete the full duration and collect the reward.
export async function stopFocusRoom(roomId: number, hostProfileId: string): Promise<FocusRoom> {
  parseProfileId(hostProfileId);
  
  const now = new Date().toISOString();

  // Only the host's own session ends. The room status is left untouched so the
  // shared countdown keeps running for everyone else who is still focusing.
  await pool.query(
    `update room_participants
     set session_status = 'left', gave_up_at = coalesce(gave_up_at, $1)
     where room_id = $2 and profile_id = $3`,
    [now, roomId, hostProfileId],
  );

  const room = await pool.query<{ id: string | number; host_profile_id: string }>(
    `select id, host_profile_id from focus_rooms where id = $1`,
    [roomId],
  );
  if (!room.rows[0]) throw new NotFoundError("Room not found");

  const updatedRoom = await getFocusRoomById(room.rows[0].host_profile_id, roomId);
  return updatedRoom!;
}

// Mark a participant as having given up
export async function participantGaveUp(roomId: number, profileId: string): Promise<void> {
  parseProfileId(profileId);
  
  const now = new Date().toISOString();

  await pool.query(
    `update room_participants 
     set session_status = 'left', gave_up_at = $1
     where room_id = $2 and profile_id = $3`,
    [now, roomId, profileId]
  );
}

// Mark a participant as having completed their session
export async function participantCompleted(roomId: number, profileId: string): Promise<void> {
  parseProfileId(profileId);
  
  const now = new Date().toISOString();

  await pool.query(
    `update room_participants 
     set session_status = 'completed', completed_at = $1
     where room_id = $2 and profile_id = $3`,
    [now, roomId, profileId]
  );
}

// Get all focus rooms for a user.
// When `forList` is true (default list view) we hide stale/archived rooms:
//  - EXPIRED rooms are always hidden.
//  - COMPLETED rooms older than `completedRetentionMs` (24h) are hidden so the
//    list doesn't accumulate clutter. Open/active/waiting rooms always show.
export async function getUserFocusRooms(
  profileId: string,
  forList: boolean = true,
  completedRetentionMs = 24 * 60 * 60 * 1000,
): Promise<FocusRoom[]> {
  parseProfileId(profileId);
  
  const ret = await pool.query<{ room_id: string | number }>(
    `select room_id from room_participants where profile_id = $1 order by joined_at desc`,
    [profileId],
  );

  // The user's own hosted rooms are always kept visible (even orphaned ones
  // where they no longer appear in room_participants, e.g. after leaving), so
  // they never lose the ability to see and delete rooms they created.
  const hosted = await pool.query<{ room_id: string | number }>(
    `select id as room_id from focus_rooms where host_profile_id = $1 order by created_at desc`,
    [profileId],
  );

  const roomIds = new Set<number>();
  for (const row of ret.rows) roomIds.add(Number(row.room_id));
  for (const row of hosted.rows) roomIds.add(Number(row.room_id));

  const rooms: FocusRoom[] = [];
  for (const id of roomIds) {
    const room = await getFocusRoomById(profileId, id);
    if (!room) continue;

    if (forList) {
      const IHost = room.hostProfileId === profileId;
      // Rooms this user created are always kept visible so they can be
      // reviewed and deleted, even once expired or completed.
      if (!IHost) {
        if (room.status === "expired") continue;
        if (room.status === "completed") {
          const reference = new Date(room.endedAt ?? room.createdAt).getTime();
          if (Date.now() - reference > completedRetentionMs) continue;
        }
      }
    }

    rooms.push(room);
  }

  return rooms;
}

// Get active rooms (for real-time display)
export async function getActiveRoomsForUser(profileId: string): Promise<FocusRoom[]> {
  parseProfileId(profileId);
  
  const result = await pool.query<{ room_id: string | number }>(
    `select room_id from room_participants 
     where profile_id = $1 and session_status in ('waiting', 'focusing')
     order by joined_at desc`,
    [profileId]
  );

  const rooms: FocusRoom[] = [];
  for (const row of result.rows) {
    const room = await getFocusRoomById(profileId, Number(row.room_id));
    if (room && (room.status === "active" || room.status === "paused")) rooms.push(room);
  }

  return rooms;
}

// Permanently delete a focus room and its participants (cascade).
// If the room is ACTIVE or PAUSED, it will be ended (completed) first.
export async function deleteFocusRoom(roomId: number, requesterProfileId: string, requesterRole?: string): Promise<void> {
  parseProfileId(requesterProfileId);
  
  const result = await pool.query<{ id: string | number; status: string; host_profile_id: string }>(
    `select id, status, host_profile_id from focus_rooms where id = $1`,
    [roomId],
  );
  if (!result.rows[0]) {
    throw new NotFoundError("Sala não encontrada.");
  }
  
  // Authorization check: only the host or an admin can delete the room
  if (result.rows[0].host_profile_id !== requesterProfileId && requesterRole !== "admin") {
    throw new ForbiddenError("Only the host or an admin can delete this room");
  }
  
  // If room is active or paused, end it first
  if (result.rows[0].status === "active" || result.rows[0].status === "paused") {
    await endFocusRoom(roomId);
  }

  const deleted = await pool.query<{ id: string | number }>(
    `delete from focus_rooms where id = $1 returning id`,
    [roomId],
  );
  if (!deleted.rows[0]) {
    throw new NotFoundError("Sala não encontrada.");
  }
}

// Mark a WAITING room as expired (stale, never started). No-op if not WAITING.
export async function expireFocusRoom(roomId: number): Promise<boolean> {
  const result = await pool.query<{ id: string | number }>(
    `update focus_rooms
     set status = 'expired',
         ended_at = coalesce(ended_at, now())
     where id = $1 and status = 'waiting'
     returning id`,
    [roomId],
  );
  return Boolean(result.rows[0]);
}

// Mark a room as completed (idempotent). Anyone who finished a session may call
// this — it transitions the room and marks any still-"focusing" participants as
// completed so the historical record is accurate.
export async function completeFocusRoom(roomId: number): Promise<FocusRoom | null> {
  const now = new Date().toISOString();

  // Get room info first to know the duration
  const roomInfo = await pool.query<{ duration_minutes: number; host_profile_id: string; energy_type: string | null }>(
    `select duration_minutes, host_profile_id, energy_type from focus_rooms where id = $1`,
    [roomId],
  );
  
  if (!roomInfo.rows[0]) return null;
  
  const durationMinutes = roomInfo.rows[0].duration_minutes;
  const roomEnergyType = roomInfo.rows[0].energy_type ?? "flame";

  await pool.query(
    `update focus_rooms
     set status = 'completed', ended_at = coalesce(ended_at, $1)
     where id = $2 and status != 'completed'`,
    [now, roomId],
  );

  await pool.query(
    `update room_participants
     set session_status = 'completed', completed_at = coalesce(completed_at, $1)
     where room_id = $2 and session_status = 'focusing'`,
    [now, roomId],
  );

  // Advance the "participate in N different rooms today" mission (DISTINCT_ROOMS)
  // for every participant who just finished in this room.
  const participants = await pool.query<{ profile_id: string; session_status: string; selected_energy_type: string | null }>(
    `select profile_id, session_status, selected_energy_type from room_participants
     where room_id = $1 and session_status = 'completed'`,
    [roomId],
  );
  const today = todayIso();
  const dayStart = new Date(`${today}T00:00:00-03:00`).toISOString();
  
  for (const p of participants.rows) {
    // Update DISTINCT_ROOMS mission
    const cnt = await pool.query<{ n: string | number }>(
      `select count(distinct room_id) as n from room_participants
       where profile_id = $1 and completed_at is not null and completed_at >= $2`,
      [p.profile_id, dayStart],
    );
    await recordMissionProgress(p.profile_id, "DISTINCT_ROOMS", { setTo: Number(cnt.rows[0]?.n || 0) });
    
    // Plant garden entries for participants who completed the room
    // This ensures all room participants get garden entries even if their
    // individual endFocus call didn't complete properly
    if (p.session_status === "completed" && durationMinutes >= 10) {
      const energyType = p.selected_energy_type || roomEnergyType || "flame";
      try {
        // Pass null for sessionId since we don't have individual session IDs here
        // The entries will still be planted and count towards the garden
        await plantGardenEntries(p.profile_id, null, energyType, durationMinutes);
      } catch {
        // If planting fails, garden entries will be planted via the
        // normal endFocusSession flow
      }
    }
  }

  const room = await pool.query<{ id: string | number; host_profile_id: string }>(
    `select id, host_profile_id from focus_rooms where id = $1`,
    [roomId],
  );
  if (!room.rows[0]) return null;

  return getFocusRoomById(room.rows[0].host_profile_id, roomId);
}

/**
 * Clean up focus rooms:
 *  - WAITING rooms older than `waitingTimeoutMs` (default 45 min) are marked "expired"
 *    so stale rooms that were never started don't accumulate.
 *  - COMPLETED/EXPIRED rooms older than `retentionMs` (default 24h) are hard-deleted.
 *    (They are already hidden from the default list after `listRetentionMs`.)
 * Returns a summary for logging.
 */
export async function cleanupStaleRooms(
  waitingTimeoutMs = 45 * 60 * 1000,
  retentionMs = 24 * 60 * 60 * 1000,
): Promise<{ expired: number; deleted: number }> {
  const waitingCutoff = new Date(Date.now() - waitingTimeoutMs).toISOString();
  const retentionCutoff = new Date(Date.now() - retentionMs).toISOString();

  const exp = await pool.query(
    `update focus_rooms
     set status = 'expired', ended_at = coalesce(ended_at, now())
     where status = 'waiting' and created_at < $1`,
    [waitingCutoff],
  );

  const del = await pool.query(
    `delete from focus_rooms
     where status in ('completed', 'expired') and coalesce(ended_at, created_at) < $1`,
    [retentionCutoff],
  );

  return { expired: exp.rowCount ?? 0, deleted: del.rowCount ?? 0 };
}
