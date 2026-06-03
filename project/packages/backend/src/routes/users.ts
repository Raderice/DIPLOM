import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
// Use require for multer to avoid missing types during build/install in CI
import path from "path";
import fs from "fs";

export function createUsersRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Get public profile by id
  router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true, stats: true }
      });
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.status(200).json({ user });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get match history for user
  router.get("/:id/history", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const sessions = await prisma.gameSession.findMany({
        where: {
          room: {
            members: {
              some: { userId: id }
            }
          }
        },
        include: {
          room: { select: { id: true, name: true, gameType: true } },
          winner: { select: { id: true, username: true } }
        },
        orderBy: { startedAt: "desc" },
        take: 50
      });

      res.status(200).json({ sessions });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get recent opponents for user
  router.get("/:id/opponents", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const rooms = await prisma.room.findMany({
        where: { members: { some: { userId: id } } },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: 50
      });

      const roomIds = rooms.map((r) => r.id);

      const opponents = await prisma.roomMember.findMany({
        where: { roomId: { in: roomIds }, userId: { not: id } },
        select: { user: { select: { id: true, username: true, avatarUrl: true } } },
        distinct: ["userId"],
        take: 20
      });

      res.status(200).json({ opponents: opponents.map((o) => o.user) });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create quick rematch room with opponent(s)
  router.post("/:id/rematch", async (req: Request, res: Response) => {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { verifyAccessToken } = await import("../utils/jwt");
      const claims = verifyAccessToken(token);
      const { id } = req.params;
      if (claims.sub !== id && claims.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const { opponentId, gameType } = req.body as { opponentId: string; gameType?: string };
      if (!opponentId) return res.status(400).json({ message: "Missing opponentId" });

      const { customAlphabet } = await import("nanoid");
      const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", 6);
      const inviteCode = nano();

      const maxPlayers = gameType === "durak" ? 6 : gameType === "mafia" ? 12 : 2;

      const room = await prisma.room.create({
        data: {
          name: `Реванш: ${claims.username}`,
          gameType: (gameType ?? "chess").toUpperCase() as any,
          maxPlayers,
          isPublic: false,
          inviteCode,
          hostId: claims.sub,
          members: {
            create: [{ userId: claims.sub }, { userId: opponentId }]
          }
        }
      });

      res.status(201).json({ roomId: room.id });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Upload avatar via JSON { imageBase64: 'data:image/png;base64,...', filename?: 'name.png' }
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  router.post("/:id/avatar", async (req: Request, res: Response) => {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { verifyAccessToken } = await import("../utils/jwt");
      const claims = verifyAccessToken(token);
      const { id } = req.params;
      if (claims.sub !== id && claims.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const body = req.body as { imageBase64?: string; filename?: string };
      if (!body?.imageBase64) return res.status(400).json({ message: "Missing imageBase64" });

      // data:[<mediatype>][;base64],<data>
      const matches = String(body.imageBase64).match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ message: "Invalid data URL" });

      const mime = matches[1];
      const base64 = matches[2];
      const ext = mime.split("/")[1] ?? "png";
      const safeName = (body.filename ? String(body.filename).replace(/[^a-zA-Z0-9.\-_]/g, "_") : `avatar.${ext}`);
      const filename = `${Date.now()}-${safeName}`;
      const filepath = path.join(uploadsDir, filename);

      fs.writeFileSync(filepath, Buffer.from(base64, "base64"));

      const relPath = `/uploads/${filename}`;

      const updated = await prisma.user.update({
        where: { id },
        data: { avatarUrl: relPath },
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true, stats: true }
      });

      res.status(200).json({ user: updated });
    } catch (err) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Update own profile (requires auth cookie)
  router.put("/:id", async (req: Request, res: Response) => {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const { verifyAccessToken } = await import("../utils/jwt");
      const claims = verifyAccessToken(token);
      const { id } = req.params;
      if (claims.sub !== id && claims.role !== "admin") {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      const { username, bio, avatarUrl } = req.body as { username?: string; bio?: string; avatarUrl?: string };

      const updateData: Record<string, any> = {};
      if (username !== undefined && username !== null) updateData.username = username.trim();
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: { id: true, username: true, email: true, role: true, avatarUrl: true, bio: true, stats: true }
      });

      res.status(200).json({ user: updated });
    } catch (err) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  return router;
}

