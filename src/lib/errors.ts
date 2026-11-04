export class AppError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticação necessária.") {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para isso.") {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisição inválida.") {
    super(message, 400);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Este recurso já existe.") {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
