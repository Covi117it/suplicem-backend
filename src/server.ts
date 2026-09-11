import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { registerRoutes } from "./interfaces/http/routes";

export const startServer = () => {
  const app = express();

  app.use(cors());

  // Logging middleware
  app.use((req, _res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Handle JSON parse errors gracefully
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ success: false, message: "JSON mal formado en el cuerpo de la petición" });
      return;
    }
    next(err);
  });

  app.use("/api", registerRoutes());

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Error global no capturado:", err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Error interno del servidor",
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  });
};

