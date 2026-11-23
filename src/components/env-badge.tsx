"use client";

import { useEffect, useState } from "react";

interface EnvInfo {
  nodeEnv: string;
  vercelEnv: string | null;
  dbHost: string;
  firebaseProjectId: string | null;
}

/**
 * Tiny dev-only badge showing which environment + database this build is
 * talking to. Hidden in production builds; the same data is available to any
 * authenticated user via GET /api/env-info.
 */
export function EnvBadge() {
  const [info, setInfo] = useState<EnvInfo | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let active = true;
    fetch("/api/env-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (active && data) setInfo(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (process.env.NODE_ENV !== "development" || !info) return null;

  const shortHost = info.dbHost.replace(/\.aws\.neon\.tech$/, "").replace(/-pooler.*$/, "");
  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-50 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] leading-tight text-white/50 backdrop-blur-sm"
      title={`DB: ${info.dbHost}\nFirebase: ${info.firebaseProjectId ?? "?"}`}
    >
      dev · {info.nodeEnv}
      {info.vercelEnv ? `/${info.vercelEnv}` : ""} · db:{shortHost}
    </div>
  );
}
