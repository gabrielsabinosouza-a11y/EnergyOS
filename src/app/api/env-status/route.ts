import { jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/server-auth";
import { NextRequest } from "next/server";

// Secret keys are reported as set/unset only — never any part of their value.
const SECRET_KEYS = new Set([
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_API_KEY",
  "RESEND_API_KEY",
  "DATABASE_URL",
]);

const KEY_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Firebase", keys: ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"] },
  { label: "Cloudinary", keys: ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] },
  { label: "Resend", keys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] },
  { label: "Database", keys: ["DATABASE_URL"] },
  { label: "App", keys: ["NEXT_PUBLIC_APP_URL", "NODE_ENV"] },
];

export async function GET(request: NextRequest) {
  // Role-based gate (DB-backed) instead of a hardcoded email address.
  const auth = await requireAdmin(request);

  const groups = KEY_GROUPS.map((group) => ({
    label: group.label,
    vars: group.keys.map((key) => {
      const isSecret = SECRET_KEYS.has(key) || key.startsWith("NEXT_PUBLIC_");
      return {
        key,
        set: Boolean(process.env[key]),
        value: key === "NODE_ENV" && !isSecret ? process.env[key] : undefined,
      };
    }),
  }));
  const allSet = groups.every((g) => g.vars.every((v) => v.set));
  return jsonOk({ groups, allSet });
}
