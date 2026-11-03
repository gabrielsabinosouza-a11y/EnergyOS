import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { auth, isFirebaseConfigured } from './firebase';

export type AuthStatus = 'restoring' | 'ready' | 'unconfigured' | 'error';

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export class AuthOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthOperationError';
  }
}

export function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Confira o formato do seu e-mail.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha inválidos.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta cadastrada com este e-mail.';
    case 'auth/weak-password':
      return 'Escolha uma senha mais segura.';
    case 'auth/user-disabled':
      return 'Esta conta está desativada. Fale com o suporte.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
    default:
      return 'Não foi possível concluir. Tente novamente.';
  }
}

function requireAuth() {
  if (!auth) {
    throw new AuthOperationError(
      'A autenticação ainda não foi configurada. Revise as variáveis Firebase do app.',
    );
  }
  return auth;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured ? 'restoring' : 'unconfigured',
  );

  useEffect(() => {
    if (!auth) return;

    return onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setStatus('ready');
      },
      () => {
        setUser(null);
        setStatus('error');
      },
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async signIn(email, password) {
        await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
      },
      async signUp(name, email, password) {
        const credential = await createUserWithEmailAndPassword(
          requireAuth(),
          email.trim(),
          password,
        );
        await updateProfile(credential.user, { displayName: name.trim() });
      },
      async sendResetEmail(email) {
        await sendPasswordResetEmail(requireAuth(), email.trim());
      },
      async signOutUser() {
        await signOut(requireAuth());
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
