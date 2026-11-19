import dotenv from "dotenv";
dotenv.config();
import http from "http";
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { registerRoutes } from "./interfaces/http/routes";
import { globalLimiter } from "./interfaces/http/middlewares/rateLimiter";
import { errorHandler } from "./interfaces/http/middlewares/errorHandler";
import { WebSocketServer } from "./infrastructure/websocket/WebSocketServer";

export const startServer = () => {
  const app = express();

  // Confiar en el proxy inverso (Nginx en AWS Lightsail)
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors());
  app.use(compression());

  // Logging middleware
  app.use((req, _res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  app.use("/api", globalLimiter);
  app.use("/api", registerRoutes());

  // Manejador de errores centralizado y sanitizado
  app.use(errorHandler);

  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);

  // Inicializar motor de WebSockets sobre el mismo servidor HTTP
  WebSocketServer.init(server);

  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  });
};

