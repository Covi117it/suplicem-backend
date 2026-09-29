export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado: no tienes permisos sobre este recurso") {
    super(message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticación requerida") {
    super(message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos de entrada inválidos") {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicto en la solicitud") {
    super(message, 409);
  }
}
