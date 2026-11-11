import { Request, Response, NextFunction } from "express";
import { auth } from "../../../config/firebase";
import { ApplicationActor } from "../../../application/dtos/UserDtos";
import { UserFirestoreRepository } from "../../../infrastructure/firestore/UserFirestoreRepository";

const userRepository = new UserFirestoreRepository();

export const authenticateOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Si no hay encabezado Authorization, continuar como anónimo
  if (!authHeader) {
    (req as any).user = undefined;
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Token no proporcionado o mal formado",
    });
    return;
  }

  const idToken = authHeader.split(" ")[1];

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (tokenError: any) {
    console.error("Token verification failed (optional auth):", tokenError?.message || tokenError);
    res.status(401).json({
      success: false,
      message: "Token inválido o expirado",
    });
    return;
  }

  try {
    const userData = await userRepository.getByIdStrict(decodedToken.uid);
    const rawUserType = userData?.userType || "client";
    const normalizedUserType = String(rawUserType).trim().toLowerCase() as any;

    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      userType: normalizedUserType,
      status: userData?.status || "pending",
    } as ApplicationActor;

    next();
  } catch (dbError: any) {
    console.error("Firestore error in optional auth middleware:", dbError?.message || dbError);
    res.status(500).json({
      success: false,
      message: "Error de conexión con la base de datos al validar usuario",
    });
  }
};