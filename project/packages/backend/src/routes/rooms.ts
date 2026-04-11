import { customAlphabet } from "nanoid";
import { Router, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { RuntimeRoom } from "../store/gameStore";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const inviteCodeGenerator = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const createRoomSchema = z.object({
  name: z.string().min(3).max(64),
  gameType: z.enum(["chess", "checkers", "durak"]),
  maxPlayers: z.number().int().min(2).max(4),
  isPublic: z.boolean()
});

const joinCodeSchema = z.object({
  inviteCode: z.string().min(6).max(6)
});

type ForceCloseRoomFn = (roomId: string, reason?: string) => Promise<void>;

function toDbGameType(gameType: "chess" | "checkers" | "durak"): "CHESS" | "CHECKERS" | "DURAK" {
  if (gameType === "chess") return "CHESS";
  if (gameType === "checkers") return "CHECKERS";
  return "DURAK";
}

async function reconcileWaitingMembersWithRuntime(
  prisma: PrismaClient,
  roomMap: Map<string, RuntimeRoom>,
  roomId: string,
  dbMemberUserIds: string[]
): Promise<string[]> {
  const runtimeRoom = roomMap.get(roomId);
  if (!runtimeRoom || runtimeRoom.status !== "WAITING") {
    return dbMemberUserIds;
  }

  const runtimeIds = new Set(runtimeRoom.players.map((player) => player.userId));
  const staleIds = dbMemberUserIds.filter((userId) => !runtimeIds.has(userId));

  if (staleIds.length === 0) {
    return dbMemberUserIds;
  }

  await prisma.roomMember.deleteMany({
    where: {
      roomId,
      userId: { in: staleIds }
    }
  });

  return dbMemberUserIds.filter((userId) => !staleIds.includes(userId));
}

export function createRoomsRouter(
  prisma: PrismaClient,
  roomMap: Map<string, RuntimeRoom>,
  forceCloseRoom: ForceCloseRoomFn
): Router {
  const router = Router();

  router.get("/public", async (_req, res: Response) => {
    const rooms = await prisma.room.findMany({
      where: {
        isPublic: true,
        status: "WAITING"
      },
      include: {
        _count: { select: { members: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    type DbPublicRoom = (typeof rooms)[number];

    res.status(200).json(
      rooms.map((room: DbPublicRoom) => ({
        ...(roomMap.has(room.id)
          ? { currentPlayers: roomMap.get(room.id)?.players.length ?? room._count.members }
          : { currentPlayers: room._count.members }),
        id: room.id,
        name: room.name,
        gameType: room.gameType.toLowerCase(),
        status: room.status,
        maxPlayers: room.maxPlayers,
        isPublic: room.isPublic,
        inviteCode: room.inviteCode,
        createdAt: room.createdAt.toISOString()
      }))
    );
  });

  router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid room payload" });
      return;
    }

    const inviteCode = inviteCodeGenerator();

    const room = await prisma.room.create({
      data: {
        name: parsed.data.name.trim(),
        gameType: toDbGameType(parsed.data.gameType),
        maxPlayers: parsed.data.maxPlayers,
        isPublic: parsed.data.isPublic,
        inviteCode,
        hostId: req.user.sub,
        members: {
          create: {
            userId: req.user.sub,
            ready: false
          }
        }
      },
      include: {
        members: true
      }
    });

    res.status(201).json({
      id: room.id,
      name: room.name,
      gameType: parsed.data.gameType,
      status: room.status,
      maxPlayers: room.maxPlayers,
      isPublic: room.isPublic,
      inviteCode: room.inviteCode,
      hostId: room.hostId,
      currentPlayers: room.members.length,
      createdAt: room.createdAt.toISOString()
    });
  });

  router.post("/:roomId/join", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const roomId = req.params.roomId;
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true }
    });

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.status !== "WAITING") {
      res.status(409).json({ message: "Room is not joinable" });
      return;
    }

    type DbRoomMember = (typeof room.members)[number];

    const memberUserIds = await reconcileWaitingMembersWithRuntime(
      prisma,
      roomMap,
      room.id,
      room.members.map((member: DbRoomMember) => member.userId)
    );

    const alreadyMember = memberUserIds.includes(req.user.sub);
    if (!alreadyMember) {
      if (memberUserIds.length >= room.maxPlayers) {
        res.status(409).json({ message: "Room is full" });
        return;
      }

      await prisma.roomMember.create({
        data: {
          roomId,
          userId: req.user.sub,
          ready: false
        }
      });
    }

    res.status(200).json({ roomId });
  });

  router.post("/join-by-code", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = joinCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid invite code" });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { inviteCode: parsed.data.inviteCode.trim().toUpperCase() },
      include: { members: true }
    });

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.status !== "WAITING") {
      res.status(409).json({ message: "Room is not joinable" });
      return;
    }

    type DbRoomMember = (typeof room.members)[number];

    const memberUserIds = await reconcileWaitingMembersWithRuntime(
      prisma,
      roomMap,
      room.id,
      room.members.map((member: DbRoomMember) => member.userId)
    );

    const alreadyMember = memberUserIds.includes(req.user.sub);
    if (!alreadyMember) {
      if (memberUserIds.length >= room.maxPlayers) {
        res.status(409).json({ message: "Room is full" });
        return;
      }

      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: req.user.sub,
          ready: false
        }
      });
    }

    res.status(200).json({ roomId: room.id, inviteCode: room.inviteCode });
  });

  router.get("/admin/active", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const rooms = Array.from(roomMap.values()).map((room) => ({
      id: room.id,
      gameType: room.gameType,
      players: room.players.length,
      status: room.status,
      createdAt: room.createdAt
    }));

    res.status(200).json(rooms);
  });

  router.post("/admin/:roomId/force-close", requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await forceCloseRoom(req.params.roomId, "force-closed-by-admin");
    res.status(200).json({ roomId: req.params.roomId, closed: true });
  });

  router.get("/:roomId", requireAuth, async (req: AuthRequest, res: Response) => {
    const room = await prisma.room.findUnique({
      where: { id: req.params.roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, role: true }
            }
          },
          orderBy: { joinedAt: "asc" }
        }
      }
    });

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    type DbRoomMember = (typeof room.members)[number];

    res.status(200).json({
      id: room.id,
      name: room.name,
      gameType: room.gameType.toLowerCase(),
      status: room.status,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      isPublic: room.isPublic,
      inviteCode: room.inviteCode,
      players: room.members.map((member: DbRoomMember) => ({
        userId: member.userId,
        username: member.user.username,
        role: member.user.role === "ADMIN" ? "admin" : "user",
        ready: member.ready,
        connected: true,
        joinedAt: member.joinedAt.toISOString()
      })),
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString()
    });
  });

  return router;
}
