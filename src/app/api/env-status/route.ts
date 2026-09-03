import { jsonOk } from "@/lib/http";
import { requireAuth } from "@/lib/server-auth";
import { NextRequest } from "next/server";

const ALLOWED_EMAIL = "pciskolargx@gmail.com";

const KEY_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Firebase", keys: ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"] },
  { label: "Cloudinary", keys: ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] },
  { label: "Resend", keys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] },
  { label: "Database", keys: ["DATABASE_URL"] },
  { label: "App", keys: ["NEXT_PUBLIC_APP_URL", "NODE_ENV"] },
];

function mask(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 6) return "••••";
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.email !== ALLOWED_EMAIL) {
    return new Response("Not found", { status: 404 });
  }

  const groups = KEY_GROUPS.map((group) => ({
    label: group.label,
    vars: group.keys.map((key) => ({
      key,
      set: Boolean(process.env[key]),
      value: key === "NODE_ENV" ? process.env[key] : mask(process.env[key]),
    })),
  }));
  const allSet = groups.every((g) => g.vars.every((v) => v.set));
  return jsonOk({ groups, allSet });
}
