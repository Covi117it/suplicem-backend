import { Request, Response, NextFunction } from "express";
import { AppError } from "../../../domain/errors/DomainErrors";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === "production";

  // Log interno para depuración segura del desarrollador
  console.error(`[Error] ${req.method} ${req.originalUrl || req.url}:`, err);

  // 1. Errores tipificados de Dominio
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // 2. Errores de sintaxis JSON en peticiones malformadas
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      message: "JSON mal formado en el cuerpo de la petición",
    });
    return;
  }

  // 3. Errores no controlados o de infraestructura (Firebase/Base de datos)
  const statusCode = err.status || err.statusCode || 500;
  const message =
    isProduction && statusCode === 500
      ? "Error interno del servidor. Por favor, intenta más tarde."
      : err.message || "Error interno del servidor";

  res.status(statusCode).json({
    success: false,
    message,
  });
};
