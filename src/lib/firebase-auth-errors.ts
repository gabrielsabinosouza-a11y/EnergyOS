type GoogleAuthAction = "login" | "signup";

export function getGoogleAuthErrorMessage(
  error: unknown,
  action: GoogleAuthAction = "login",
): string {
  const authError = error as { code?: unknown; message?: unknown } | null;
  const code = typeof authError?.code === "string" ? authError.code : "unknown";
  const message =
    typeof authError?.message === "string" ? authError.message : String(error);

  console.error("[auth/google] Authentication failed", { code, message });

  switch (code) {
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela de autenticação. Permita pop-ups e tente novamente.";
    case "auth/popup-closed-by-user":
      return "A janela de autenticação foi fechada antes da conclusão.";
    case "auth/cancelled-popup-request":
      return "Já existe uma tentativa de autenticação em andamento. Tente novamente.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado para autenticação no Firebase.";
    case "auth/operation-not-allowed":
      return "O acesso com Google não está habilitado no Firebase.";
    case "auth/network-request-failed":
      return "Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.";
    case "auth/internal-error":
      return "O Firebase encontrou um erro interno durante a autenticação.";
    default:
      return action === "signup"
        ? "Não foi possível criar sua conta com o Google. Tente novamente."
        : "Não foi possível entrar com o Google. Tente novamente.";
  }
}
