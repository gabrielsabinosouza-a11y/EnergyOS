"use client";

import { useEffect, useState } from "react";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getGoogleAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(auth ? "" : "Firebase não configurado");

  useEffect(() => {
    if (!auth) return;

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          router.push("/dashboard");
        } else {
          // No redirect result — user navigated here directly
          router.push("/login");
        }
      })
      .catch((err: unknown) => {
        const code = (err as { code?: string })?.code;
        const message = getGoogleAuthErrorMessage(err);
        // "missing initial state" happens when the user refreshes the
        // callback page or navigates here directly — not a real auth failure.
        if (code === "auth/missing-initial-state") {
          router.push("/login");
        } else {
          setError(message);
        }
      });
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="panel p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 text-sm text-[#71d4ff] hover:underline"
          >
            Voltar para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
    </div>
  );
}
