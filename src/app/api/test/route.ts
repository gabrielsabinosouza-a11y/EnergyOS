import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { handleRoute, jsonOk } from "@/lib/http";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    console.log('[test] Testing API endpoint');
    
    // Test authentication
    const { profileId, email, displayName } = await requireAuth(request);
    console.log('[test] Auth successful:', { profileId, email, displayName });
    
    // Test database connection
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      console.log('[test] Database connection successful:', result.rows[0]);
    } catch (dbError) {
      console.error('[test] Database connection failed:', dbError);
      throw new Error('Database connection failed');
    }
    
    // Test profile existence
    try {
      const profileResult = await pool.query(
        'SELECT id, display_name, email FROM profiles WHERE id = $1',
        [profileId]
      );
      console.log('[test] Profile query result:', profileResult.rows[0] || 'No profile found');
    } catch (profileError) {
      console.error('[test] Profile query failed:', profileError);
    }
    
    return jsonOk({
      message: "API test successful",
      auth: { profileId, email, displayName },
      database: "connected",
      timestamp: new Date().toISOString()
    });
  });
}