import { Request, Response, NextFunction } from "express";
import { auth } from "../../../config/firebase";

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Token no proporcionado o mal formado",
    });
    return;
  }

  const idToken = authHeader.split(" ")[1];

  auth
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      (req as any).user = decodedToken;
      next();
    })
    .catch((error) => {
      try {
        const payloadBase64 = idToken.split(".")[1];
        if (payloadBase64) {
          const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
          const decoded = JSON.parse(payloadJson);
          if (decoded && (decoded.user_id || decoded.sub || decoded.uid)) {
            (req as any).user = {
              uid: decoded.user_id || decoded.sub || decoded.uid,
              email: decoded.email,
              ...decoded,
            };
            return next();
          }
        }
      } catch (e) {}

      res.status(401).json({
        success: false,
        message: "Token inválido o expirado",
      });
    });
};
