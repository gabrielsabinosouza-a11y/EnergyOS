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

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para isso.") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Este recurso já existe.") {
    super(message, 409);
  }
}
