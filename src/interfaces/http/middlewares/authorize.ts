import { Request, Response, NextFunction } from "express";

export const requireRole = (allowedRoles: Array<"client" | "driver" | "admin">) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Usuario no autenticado",
      });
      return;
    }

    const userRole = String(user.userType || "").trim().toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: `Acceso denegado: se requiere uno de los siguientes roles [${allowedRoles.join(", ")}]`,
      });
      return;
    }

    next();
  };
};