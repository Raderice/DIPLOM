import http from "node:http";
import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { config, isAllowedOrigin } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { createAuthRouter } from "./routes/auth";
import { createRoomsRouter } from "./routes/rooms";
import { createAdminRouter } from "./routes/admin";
import { createUsersRouter } from "./routes/users";
import { createSocketServer } from "./socket";
import { roomCount, roomStore } from "./store/gameStore";

const prisma = new PrismaClient({
  log: config.nodeEnv === "development" ? ["warn", "error"] : ["error"]
});

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(config.nodeEnv === "development" ? "dev" : "tiny"));

const { io, closeRoom } = createSocketServer(server, prisma, roomStore());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    roomsInMemory: roomCount()
  });
});

app.use("/api/auth", createAuthRouter(prisma));
app.use("/api/rooms", createRoomsRouter(prisma, roomStore(), closeRoom));
app.use("/api/admin", createAdminRouter(roomStore(), closeRoom));
app.use("/api/users", createUsersRouter(prisma));

// Serve uploaded avatars
const uploadsPath = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

app.use(errorHandler);

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  server.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port} (${config.nodeEnv})`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down...`);
  io.removeAllListeners();
  await prisma.$disconnect();
  server.close((error) => {
    if (error) {
      console.error("Server close failed", error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void bootstrap();
