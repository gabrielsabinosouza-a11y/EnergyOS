const passwordResetMessages: Record<string, string> = {
  "auth/weak-password": "Essa senha é muito fácil de adivinhar. Escolha uma senha mais forte.",
  "auth/expired-action-code": "Este link expirou. Solicite um novo link de recuperação.",
  "auth/invalid-action-code": "Este link já foi usado ou não é válido. Solicite um novo link.",
  "auth/user-disabled": "Esta conta está desativada. Entre em contato com o suporte.",
  "auth/user-not-found": "Não foi possível encontrar uma conta para este link.",
  "auth/network-request-failed": "Não foi possível conectar. Verifique sua internet e tente novamente.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco antes de tentar novamente.",
};

export function getPasswordResetErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  return passwordResetMessages[code] ?? "Não foi possível redefinir sua senha. Tente novamente.";
}
