import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { registerRoutes } from "./interfaces/http/routes";
import { globalLimiter } from "./interfaces/http/middlewares/rateLimiter";
import { errorHandler } from "./interfaces/http/middlewares/errorHandler";

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

  app.use("/api", globalLimiter);
  app.use("/api", registerRoutes());

  // Manejador de errores centralizado y sanitizado
  app.use(errorHandler);

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  });
};

