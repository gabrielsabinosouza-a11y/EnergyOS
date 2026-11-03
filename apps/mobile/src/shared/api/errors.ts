export type ApiErrorKind =
  | 'configuration'
  | 'auth'
  | 'unauthorized'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'http'
  | 'network'
  | 'invalid_response';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
