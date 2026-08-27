import pool from "../db";

// Types matching the database schema
export type RoomStatus = "waiting" | "active" | "completed";
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
  if (!hostProfileId) throw new Error("Host profile ID is required");
  if (durationMinutes <= 0) throw new Error("Duration must be positive");

  // Generate a unique code
  let code = generateRoomCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (await roomCodeExists(code) && attempts < maxAttempts) {
    code = generateRoomCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error("Failed to generate a unique room code");
  }

  const result = await pool.query<FocusRoomRow>(
    `insert into focus_rooms (code, host_profile_id, status, duration_minutes, energy_type)
     values ($1, $2, $3, $4, $5)
     returning id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at`,
    [code, hostProfileId, "waiting", durationMinutes, energyType ?? null]
  );

  // Add host as first participant
  await pool.query<RoomParticipantRow>(
    `insert into room_participants (room_id, profile_id, session_status, selected_energy_type)
     values ($1, $2, $3, $4)`,
    [result.rows[0].id, hostProfileId, "waiting", energyType ?? null]
  );

  // Fetch the created room with participants
  const room = await getFocusRoomById(hostProfileId, Number(result.rows[0].id));
  return room!;
}

// Get a focus room by ID
export async function getFocusRoomById(profileId: string, roomId: number): Promise<FocusRoom | null> {
  const result = await pool.query<FocusRoomRow>(
    `select id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at
     from focus_rooms where id = $1`,
    [roomId]
  );

  if (!result.rows[0]) return null;

  const participants = await getRoomParticipants(roomId);
  return mapFocusRoom(result.rows[0], participants);
}

// Get a focus room by code
export async function getFocusRoomByCode(code: string): Promise<FocusRoom | null> {
  const result = await pool.query<FocusRoomRow>(
    `select id, code, host_profile_id, status, duration_minutes, energy_type, created_at, started_at, ended_at
     from focus_rooms where code = $1`,
    [code]
  );

  if (!result.rows[0]) return null;

  const participants = await getRoomParticipants(Number(result.rows[0].id));
  return mapFocusRoom(result.rows[0], participants);
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
  const result = await pool.query<RoomParticipantRow>(
    `update room_participants 
     set selected_energy_type = $1 
     where room_id = $2 and profile_id = $3 
     returning id, room_id, profile_id, joined_at, session_status, selected_energy_type, completed_at, gave_up_at`,
    [energyType, roomId, profileId]
  );

  if (!result.rows[0]) {
    throw new Error("Participant not found");
  }

  return mapRoomParticipant(result.rows[0]);
}

// Update the room's duration (host only)
export async function updateRoomDuration(roomId: number, hostProfileId: string, durationMinutes: number): Promise<FocusRoom> {
  if (durationMinutes <= 0) throw new Error("Duration must be positive");

  // Verify host
  const room = await pool.query<{ host_profile_id: string }>(
    `select host_profile_id from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new Error("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new Error("Only the host can update the room duration");
  }

  const result = await pool.query<FocusRoomRow>(
    `update focus_rooms set duration_minutes = $1 where id = $2 returning *`,
    [durationMinutes, roomId]
  );

  const participants = await getRoomParticipants(roomId);
  return mapFocusRoom(result.rows[0], participants);
}

// Add a participant to a room
export async function addParticipantToRoom(roomId: number, profileId: string, selectedEnergyType?: string): Promise<RoomParticipant> {
  // Check if user is already in the room
  const existing = await pool.query<{ id: string | number }>(
    `select id from room_participants where room_id = $1 and profile_id = $2`,
    [roomId, profileId]
  );

  if (existing.rows[0]) {
    throw new Error("User already in room");
  }

  // Check room status
  const room = await pool.query<{ status: string }>(
    `select status from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new Error("Room not found");
  }

  if (room.rows[0].status !== "waiting") {
    throw new Error("Cannot join a room that has already started or completed");
  }

  const result = await pool.query<RoomParticipantRow>(
    `insert into room_participants (room_id, profile_id, session_status, selected_energy_type)
     values ($1, $2, $3, $4)
     returning id, room_id, profile_id, joined_at, session_status, selected_energy_type, completed_at, gave_up_at`,
    [roomId, profileId, "waiting", selectedEnergyType ?? null]
  );

  return mapRoomParticipant(result.rows[0]);
}

// Remove a participant from a room
export async function removeParticipantFromRoom(roomId: number, profileId: string): Promise<void> {
  await pool.query(
    `delete from room_participants where room_id = $1 and profile_id = $2`,
    [roomId, profileId]
  );
}

// Start a focus room (host only)
export async function startFocusRoom(roomId: number, hostProfileId: string): Promise<FocusRoom> {
  // Verify host
  const room = await pool.query<{ host_profile_id: string; status: string }>(
    `select host_profile_id, status from focus_rooms where id = $1`,
    [roomId]
  );

  if (!room.rows[0]) {
    throw new Error("Room not found");
  }

  if (room.rows[0].host_profile_id !== hostProfileId) {
    throw new Error("Only the host can start the room");
  }

  if (room.rows[0].status !== "waiting") {
    throw new Error("Room is not in waiting state");
  }

  const now = new Date().toISOString();

  await pool.query(
    `update focus_rooms set status = 'active', started_at = $1 where id = $2`,
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

// End a focus room
export async function endFocusRoom(roomId: number): Promise<FocusRoom> {
  const now = new Date().toISOString();

  await pool.query(
    `update focus_rooms set status = 'completed', ended_at = $1 where id = $2 and status = 'active'`,
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
    throw new Error("Room not found");
  }

  const completedRoom = await getFocusRoomById(room.rows[0].host_profile_id, roomId);
  return completedRoom!;
}

// Mark a participant as having given up
export async function participantGaveUp(roomId: number, profileId: string): Promise<void> {
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
  const now = new Date().toISOString();

  await pool.query(
    `update room_participants 
     set session_status = 'completed', completed_at = $1
     where room_id = $2 and profile_id = $3`,
    [now, roomId, profileId]
  );
}

// Get all focus rooms for a user
export async function getUserFocusRooms(profileId: string): Promise<FocusRoom[]> {
  const result = await pool.query<{ room_id: string | number }>(
    `select room_id from room_participants where profile_id = $1 order by joined_at desc`,
    [profileId]
  );

  const rooms: FocusRoom[] = [];
  for (const row of result.rows) {
    const room = await getFocusRoomById(profileId, Number(row.room_id));
    if (room) rooms.push(room);
  }

  return rooms;
}

// Get active rooms (for real-time display)
export async function getActiveRoomsForUser(profileId: string): Promise<FocusRoom[]> {
  const result = await pool.query<{ room_id: string | number }>(
    `select room_id from room_participants 
     where profile_id = $1 and session_status in ('waiting', 'focusing')
     order by joined_at desc`,
    [profileId]
  );

  const rooms: FocusRoom[] = [];
  for (const row of result.rows) {
    const room = await getFocusRoomById(profileId, Number(row.room_id));
    if (room && room.status === "active") rooms.push(room);
  }

  return rooms;
}

// Clean up stale rooms (older than 24 hours)
export async function cleanupStaleRooms(): Promise<void> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  await pool.query(
    `delete from focus_rooms 
     where created_at < $1 and status != 'active'`,
    [twentyFourHoursAgo]
  );
}
