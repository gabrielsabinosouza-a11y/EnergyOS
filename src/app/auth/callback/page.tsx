"use client";

import { useEffect, useState } from "react";
import { getRedirectResult, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      setError("Firebase não configurado");
      return;
    }

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          router.push("/dashboard");
        } else {
          // No redirect result — user navigated here directly
          router.push("/login");
        }
      })
      .catch(() => {
        setError("Não foi possível autenticar com o Google.");
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
