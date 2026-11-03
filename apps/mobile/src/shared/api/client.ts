import { auth } from '@/auth/firebase';
import type { User } from 'firebase/auth';
import { ApiError } from './errors';

type JsonRecord = Record<string, unknown>;

function getTokenError(error: unknown): ApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  if (code === 'auth/network-request-failed') {
    return new ApiError('Não foi possível validar sua sessão por causa da conexão.', 'network');
  }
  if (code === 'auth/user-token-expired' || code === 'auth/invalid-user-token') {
    return new ApiError('Sua sessão expirou. Entre novamente.', 'unauthorized', 401);
  }
  return new ApiError('Não foi possível validar sua sessão.', 'auth');
}

async function getIdToken(user: User, forceRefresh = false) {
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    throw getTokenError(error);
  }
}

function getBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ApiError(
      'Configure EXPO_PUBLIC_API_BASE_URL antes de conectar ao EnergyOS.',
      'configuration',
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new ApiError('A URL da API configurada é inválida.', 'configuration');
  }

  if (
    (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new ApiError('A URL da API configurada é inválida.', 'configuration');
  }

  return baseUrl.replace(/\/+$/, '');
}

function getRequestUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new ApiError('O caminho da API deve começar com "/".', 'configuration');
  }
  return `${getBaseUrl()}${path}`;
}

function getErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const message = (body as JsonRecord).error;
  return typeof message === 'string' ? message : undefined;
}

function makeHttpError(response: Response, body: unknown): ApiError {
  const message = getErrorMessage(body) ?? `A solicitação falhou (${response.status}).`;

  if (response.status === 401) return new ApiError(message, 'unauthorized', 401);
  if (response.status === 400 || response.status === 422) {
    return new ApiError(message, 'validation', response.status);
  }
  if (response.status === 429) return new ApiError(message, 'rate_limit', 429);
  if (response.status >= 500) return new ApiError(message, 'server', response.status);
  return new ApiError(message, 'http', response.status);
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError('A API retornou uma resposta em formato inválido.', 'invalid_response');
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('A API retornou uma resposta JSON inválida.', 'invalid_response');
  }
}

async function send(
  url: string,
  options: RequestInit,
  token: string,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(url, { ...options, headers });
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new ApiError('Não foi possível conectar. Verifique sua internet e tente novamente.', 'network');
    }
    throw error;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!auth) {
    throw new ApiError('A autenticação Firebase do app não está configurada.', 'configuration');
  }

  const user = auth.currentUser;
  if (!user) throw new ApiError('Entre na sua conta para continuar.', 'unauthorized', 401);

  const url = getRequestUrl(path);
  const method = (options.method ?? 'GET').toUpperCase();
  const firstToken = await getIdToken(user);
  let response = await send(url, options, firstToken);

  if (
    response.status === 401 &&
    (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
  ) {
    const refreshedToken = await getIdToken(user, true);
    response = await send(url, options, refreshedToken);
  }

  const body = await readJson(response);
  if (!response.ok) throw makeHttpError(response, body);
  return body as T;
}

export const api = {
  get: <T>(path: string, options: Omit<RequestInit, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  patch: <T>(path: string, body: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, options: Omit<RequestInit, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
