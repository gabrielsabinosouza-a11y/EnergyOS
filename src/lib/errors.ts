export class AppError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticação necessária.") {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404);
  }
}
