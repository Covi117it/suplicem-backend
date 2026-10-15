import { Request, Response, NextFunction } from "express";
import { auth, firestore } from "../../../config/firebase";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  userType: "client" | "driver" | "admin";
  status?: string;
  [key: string]: any;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Token no proporcionado o mal formado",
    });
    return;
  }

  const idToken = authHeader.split(" ")[1];

  let decodedToken;
  try {
    // 1. Verificación criptográfica estricta con Firebase Admin
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (tokenError: any) {
    console.error("Token verification failed:", tokenError?.message || tokenError);
    res.status(401).json({
      success: false,
      message: "Token inválido o expirado",
    });
    return;
  }

  try {
    // 2. Obtener el rol y estado real del usuario desde Firestore
    const userDoc = await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const userData = userDoc.data();
    const rawUserType = userData?.userType || "client";
    const normalizedUserType = String(rawUserType).trim().toLowerCase();

    const userStatus = userData?.status || "pending";
    const isAuthMe = req.path === "/auth/me" || (req.originalUrl && req.originalUrl.includes("/auth/me"));

    if (!isAuthMe && (userStatus === "inactive" || userStatus === "banned")) {
      res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        message: "Acceso denegado: su cuenta se encuentra inactiva o suspendida",
      });
      return;
    }

    (req as any).user = {
      ...decodedToken,
      uid: decodedToken.uid,
      email: decodedToken.email,
      userType: normalizedUserType,
      status: userStatus,
    } as AuthenticatedUser;

    next();
  } catch (dbError: any) {
    console.error("Firestore error in auth middleware:", dbError?.message || dbError);
    res.status(500).json({
      success: false,
      message: "Error de conexión con la base de datos al validar usuario",
    });
  }
};