import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { Server, type Socket } from "socket.io";
import type {
  Ack,
  ChatMessage,
  ChatMessagePayload,
  ClientToServerEvents,
  GameOverPayload,
  GameState,
  JwtUserClaims,
  PlayerInRoom,
  RoomStatus,
  ServerToClientEvents,
} from "@board-games/shared";
import { SOCKET_NAMESPACE, validateGamePlayerCount } from "@board-games/shared";
import { config, isAllowedOrigin } from "../config";
import type { RuntimeRoom } from "../store/gameStore";
import { getRoom, removeRoom, setRoom } from "../store/gameStore";
import { verifyAccessToken } from "../utils/jwt";
import { toClientGameState, toClientRoom, parseCookie } from "./roomHandlers";
import { applyChessMove, createInitialChessState } from "./games/chess";
import { applyCheckersMove, createInitialCheckersState } from "./games/checkers";
import { applyDurakMove, createInitialDurakState } from "./games/durak";
import { applyAliasMove, createInitialAliasState } from "./games/alias";
import { applyMafiaMove, createInitialMafiaState } from "./games/mafia";

interface SocketData {
  user: JwtUserClaims;
  joinedRooms: Set<string>;
}

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

type RuntimeMap = Map<string, RuntimeRoom>;

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(data: T): Ack<T> {
  return { ok: true, data };
}

function fail<T>(error: string): Ack<T> {
  return { ok: false, error };
}

function normalizeGameType(value: string): "chess" | "checkers" | "durak" | "alias" | "mafia" {
  if (value === "CHESS" || value === "chess") return "chess";
  if (value === "CHECKERS" || value === "checkers") return "checkers";
  if (value === "ALIAS" || value === "alias") return "alias";
  if (value === "MAFIA" || value === "mafia") return "mafia";
  return "durak";
}

function normalizeRoomStatus(value: string): RoomStatus {
  if (value === "PLAYING") return "PLAYING";
  if (value === "FINISHED") return "FINISHED";
  return "WAITING";
}

function emitRoomUpdate(io: IoServer, room: RuntimeRoom): void {
  io.to(room.id).emit("room:update", {
    roomId: room.id,
    status: room.status,
    players: room.players
  });
}

function emitGameState(io: IoServer, room: RuntimeRoom): void {
  const adapter = io.adapter as unknown as { rooms: Map<string, Set<string>> };
  const socketIds = adapter.rooms.get(room.id);
  if (!socketIds) return;

  const sockets = io.sockets as unknown as Map<string, IoSocket>;

  for (const socketId of socketIds) {
    const socket = sockets.get(socketId);
    if (!socket) continue;
    socket.emit("game:state", {
      roomId: room.id,
      state: toClientGameState(room, socket.data.user.sub)
    });
  }
}

function hasOtherConnectedSocketForUser(
  io: IoServer,
  roomId: string,
  userId: string,
  disconnectedSocketId: string
): boolean {
  const adapter = io.adapter as unknown as { rooms: Map<string, Set<string>> };
  const socketIds = adapter.rooms.get(roomId);
  if (!socketIds) return false;

  const sockets = io.sockets as unknown as Map<string, IoSocket>;

  for (const socketId of socketIds) {
    if (socketId === disconnectedSocketId) continue;
    const peerSocket = sockets.get(socketId);
    if (!peerSocket || !peerSocket.connected) continue;
    if (peerSocket.data?.user?.sub === userId) {
      return true;
    }
  }

  return false;
}

function resolveWinnerOnAbandon(room: RuntimeRoom, abandonedUserId: string): string | null {
  const connected = room.players.filter((p) => p.connected && p.userId !== abandonedUserId);
  return connected.length > 0 ? connected[0].userId : null;
}

async function removeMemberFromWaitingRoom(
  prisma: PrismaClient,
  room: RuntimeRoom,
  userId: string
): Promise<{ roomDeleted: boolean; hostChanged: boolean }> {
  const existingTimer = room.disconnectTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    room.disconnectTimers.delete(userId);
  }

  const memberIndex = room.players.findIndex((player) => player.userId === userId);
  const removed = await prisma.roomMember.deleteMany({
    where: {
      roomId: room.id,
      userId
    }
  });

  if (memberIndex !== -1) {
    room.players.splice(memberIndex, 1);
  } else if (removed.count === 0) {
    return { roomDeleted: false, hostChanged: false };
  }

  if (room.players.length === 0) {
    removeRoom(room.id);
    await prisma.room.delete({ where: { id: room.id } }).catch(() => undefined);
    return { roomDeleted: true, hostChanged: false };
  }

  let hostChanged = false;
  if (room.hostId === userId) {
    const nextHostId = room.players[0]?.userId;
    if (nextHostId) {
      room.hostId = nextHostId;
      hostChanged = true;
    }
  }

  room.updatedAt = nowIso();

  if (hostChanged) {
    await prisma.room.update({
      where: { id: room.id },
      data: { hostId: room.hostId }
    });
  }

  return { roomDeleted: false, hostChanged };
}

async function finishPlayingRoomByForfeit(
  prisma: PrismaClient,
  io: IoServer,
  room: RuntimeRoom,
  loserUserId: string,
  reason = "player-left"
): Promise<void> {
  if (room.status !== "PLAYING") {
    return;
  }

  const loser = room.players.find((player) => player.userId === loserUserId);
  if (!loser) {
    return;
  }

  const existingTimer = room.disconnectTimers.get(loserUserId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    room.disconnectTimers.delete(loserUserId);
  }

  loser.connected = false;
  room.status = "FINISHED";
  room.updatedAt = nowIso();

  const winnerId = resolveWinnerOnAbandon(room, loserUserId);
  const gameOverPayload: GameOverPayload = {
    roomId: room.id,
    winnerId,
    reason
  };

  io.to(room.id).emit("game:over", gameOverPayload);
  emitRoomUpdate(io, room);

  await prisma.room.update({ where: { id: room.id }, data: { status: "FINISHED" } });
  await prisma.gameSession.updateMany({
    where: { roomId: room.id, endedAt: null },
    data: { endedAt: new Date(), winnerId }
  });
}

async function closeWaitingRoomByHostLeave(
  prisma: PrismaClient,
  io: IoServer,
  room: RuntimeRoom,
  message = "Host left the room. Room is closed."
): Promise<void> {
  if (room.status !== "WAITING") {
    return;
  }

  room.status = "FINISHED";
  room.updatedAt = nowIso();
  emitRoomUpdate(io, room);
  io.to(room.id).emit("server:error", { message });

  const roomChannel = io.in(room.id);
  roomChannel.socketsLeave(room.id);

  removeRoom(room.id);
  await prisma.room.delete({ where: { id: room.id } }).catch(() => undefined);
}

function makeInitialState(gameType: "chess" | "checkers" | "durak" | "alias" | "mafia", players: PlayerInRoom[]) {
  const pendingPlayer: PlayerInRoom = {
    userId: "__pending_player__",
    username: "Pending",
    role: "user",
    ready: false,
    connected: false,
    joinedAt: nowIso()
  };

  const withPending = (minPlayers: number): PlayerInRoom[] => {
    if (players.length >= minPlayers) return players;
    const result = [...players];
    while (result.length < minPlayers) {
      result.push({ ...pendingPlayer, userId: `${pendingPlayer.userId}-${result.length}` });
    }
    return result;
  };

  const readyPlayers = withPending(2);

  if (gameType === "chess") return createInitialChessState(readyPlayers);
  if (gameType === "checkers") return createInitialCheckersState(readyPlayers);
  if (gameType === "alias") return createInitialAliasState(withPending(4));
  if (gameType === "mafia") return createInitialMafiaState(withPending(6));
  return createInitialDurakState(readyPlayers);
}

async function loadOrInitRoom(
  prisma: PrismaClient,
  runtimeMap: RuntimeMap,
  roomId: string,
  userId: string
): Promise<RuntimeRoom> {
  const dbRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" }
      }
    }
  });

  if (!dbRoom) {
    throw new Error("Room not found");
  }

  type DbRoomMember = (typeof dbRoom.members)[number];
  const existing = runtimeMap.get(roomId);
  const existingConnected = new Map((existing?.players ?? []).map((player) => [player.userId, player.connected]));

  let members = dbRoom.members;
  const alreadyMember = members.some((member: DbRoomMember) => member.userId === userId);
  if (!alreadyMember) {
    if (members.length >= dbRoom.maxPlayers) {
      throw new Error("Room is full");
    }
    await prisma.roomMember.create({
      data: { roomId: dbRoom.id, userId }
    });
    members = await prisma.roomMember.findMany({
      where: { roomId: dbRoom.id },
      include: { user: true },
      orderBy: { joinedAt: "asc" }
    });
  }

  const players: PlayerInRoom[] = members.map((member: DbRoomMember) => ({
    userId: member.userId,
    username: member.user.username,
    role: member.user.role === "ADMIN" ? "admin" : "user",
    ready: member.ready,
    connected: member.userId === userId || existingConnected.get(member.userId) === true,
    joinedAt: member.joinedAt.toISOString()
  }));

  const gameType = normalizeGameType(dbRoom.gameType);

  if (existing) {
    existing.name = dbRoom.name;
    existing.gameType = gameType;
    existing.status = normalizeRoomStatus(dbRoom.status);
    existing.hostId = dbRoom.hostId;
    existing.maxPlayers = dbRoom.maxPlayers;
    existing.isPublic = dbRoom.isPublic;
    existing.inviteCode = dbRoom.inviteCode;
    existing.players = players;
    if (existing.status === "WAITING") {
      existing.state = makeInitialState(gameType, players);
    }
    existing.updatedAt = nowIso();

    const existingIds = new Set(players.map((player) => player.userId));
    for (const [timerUserId, timer] of existing.disconnectTimers.entries()) {
      if (!existingIds.has(timerUserId)) {
        clearTimeout(timer);
        existing.disconnectTimers.delete(timerUserId);
      }
    }

    setRoom(existing);
    return existing;
  }

  const room: RuntimeRoom = {
    id: dbRoom.id,
    name: dbRoom.name,
    gameType,
    status: normalizeRoomStatus(dbRoom.status),
    hostId: dbRoom.hostId,
    maxPlayers: dbRoom.maxPlayers,
    isPublic: dbRoom.isPublic,
    inviteCode: dbRoom.inviteCode,
    players,
    chat: [],
    state: makeInitialState(gameType, players),
    createdAt: dbRoom.createdAt.toISOString(),
    updatedAt: dbRoom.updatedAt.toISOString(),
    disconnectTimers: new Map<string, NodeJS.Timeout>()
  };

  setRoom(room);
  return room;
}

export function createSocketServer(
  server: HttpServer,
  prisma: PrismaClient,
  runtimeMap: RuntimeMap
): {
  io: IoServer;
  closeRoom: (roomId: string, reason?: string) => Promise<void>;
} {
  const namespace = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    server,
    {
      path: "/socket.io",
      cors: {
        origin: (origin, callback) => {
          if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("CORS origin not allowed"));
        },
        credentials: true
      },
      transports: ["polling", "websocket"]
    }
  ).of(SOCKET_NAMESPACE) as unknown as IoServer;

  namespace.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie);
      const accessToken = cookies.access_token;
      if (!accessToken) {
        next(new Error("Unauthorized"));
        return;
      }

      const claims = verifyAccessToken(accessToken);
      socket.data.user = claims;
      socket.data.joinedRooms = new Set<string>();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  const closeRoom = async (roomId: string, reason = "force-closed"): Promise<void> => {
    const room = runtimeMap.get(roomId);
    if (!room) {
      await prisma.room.update({ where: { id: roomId }, data: { status: "FINISHED" } }).catch(() => undefined);
      return;
    }

    room.status = "FINISHED";
    room.updatedAt = nowIso();

    const payload: GameOverPayload = {
      roomId,
      winnerId: null,
      reason
    };

    namespace.to(roomId).emit("game:over", payload);
    emitRoomUpdate(namespace, room);

    await prisma.room.update({
      where: { id: roomId },
      data: { status: "FINISHED" }
    });

    removeRoom(roomId);
  };

  namespace.on("connection", (socket: IoSocket) => {
    socket.on("room:join", async (payload, ack) => {
      try {
        const room = await loadOrInitRoom(prisma, runtimeMap, payload.roomId, socket.data.user.sub);

        const player = room.players.find((p) => p.userId === socket.data.user.sub);
        if (player) {
          player.connected = true;
        }

        const timer = room.disconnectTimers.get(socket.data.user.sub);
        if (timer) {
          clearTimeout(timer);
          room.disconnectTimers.delete(socket.data.user.sub);
          namespace.to(room.id).emit("player:reconnected", {
            roomId: room.id,
            userId: socket.data.user.sub
          });
        }

        socket.join(room.id);
        socket.data.joinedRooms.add(room.id);

        room.updatedAt = nowIso();

        socket.emit("room:joined", {
          room: toClientRoom(room, socket.data.user.sub),
          selfId: socket.data.user.sub
        });

        emitRoomUpdate(namespace, room);
        emitGameState(namespace, room);

        ack(ok({ room: toClientRoom(room, socket.data.user.sub) }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to join room";
        ack(fail(message));
      }
    });

    socket.on("room:leave", async (payload, ack) => {
      try {
        const room = getRoom(payload.roomId);
        if (!room) {
          ack(fail("Room not active"));
          return;
        }

        const userId = socket.data.user.sub;

        if (room.status === "WAITING") {
          if (room.hostId === userId) {
            socket.leave(room.id);
            socket.data.joinedRooms.delete(room.id);

            await closeWaitingRoomByHostLeave(prisma, namespace, room);
            ack(ok({ roomId: room.id }));
            return;
          }

          const result = await removeMemberFromWaitingRoom(prisma, room, userId);

          socket.leave(room.id);
          socket.data.joinedRooms.delete(room.id);

          if (!result.roomDeleted) {
            emitRoomUpdate(namespace, room);
          }

          ack(ok({ roomId: room.id }));
          return;
        }

        if (room.status === "PLAYING") {
          const me = room.players.find((p) => p.userId === userId);
          if (!me) {
            ack(fail("Not in room"));
            return;
          }

          socket.leave(room.id);
          socket.data.joinedRooms.delete(room.id);

          await finishPlayingRoomByForfeit(prisma, namespace, room, userId, "player-left");

          ack(ok({ roomId: room.id }));
          return;
        }

        socket.leave(room.id);
        socket.data.joinedRooms.delete(room.id);
        ack(ok({ roomId: room.id }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to leave room";
        ack(fail(message));
      }
    });

    socket.on("room:ready", async (payload, ack) => {
      try {
        const room = getRoom(payload.roomId);
        if (!room) {
          ack(fail("Room not active"));
          return;
        }

        const me = room.players.find((p) => p.userId === socket.data.user.sub);
        if (!me) {
          ack(fail("Not in room"));
          return;
        }

        me.ready = payload.ready;
        room.updatedAt = nowIso();

        await prisma.roomMember.update({
          where: {
            roomId_userId: {
              roomId: room.id,
              userId: socket.data.user.sub
            }
          },
          data: { ready: payload.ready }
        });

        emitRoomUpdate(namespace, room);
        ack(ok({ roomId: room.id, ready: payload.ready }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update ready";
        ack(fail(message));
      }
    });

    socket.on("room:start", async (payload, ack) => {
      try {
        const room = getRoom(payload.roomId);
        if (!room) {
          ack(fail("Room not active"));
          return;
        }

        if (room.hostId !== socket.data.user.sub) {
          ack(fail("Only host can start"));
          return;
        }

        if (room.status !== "WAITING") {
          ack(fail("Room already started"));
          return;
        }

        const connectedPlayers = room.players.filter((p) => p.connected);
        if (connectedPlayers.length < 2) {
          ack(fail("Not enough connected players"));
          return;
        }

        const playerCountCheck = validateGamePlayerCount(room.gameType, connectedPlayers.length);
        if (!playerCountCheck.ok) {
          ack(fail(playerCountCheck.message ?? "Invalid player count for game"));
          return;
        }

        if (!connectedPlayers.every((p) => p.ready)) {
          ack(fail("All connected players must be ready"));
          return;
        }

        room.state = makeInitialState(room.gameType, connectedPlayers);

        room.status = "PLAYING";
        room.updatedAt = nowIso();

        await prisma.room.update({ where: { id: room.id }, data: { status: "PLAYING" } });
        await prisma.gameSession.create({ data: { roomId: room.id } });

        emitRoomUpdate(namespace, room);
        emitGameState(namespace, room);

        ack(ok({ roomId: room.id, status: room.status }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to start room";
        ack(fail(message));
      }
    });

    socket.on("game:move", async (payload, ack) => {
      try {
        const room = getRoom(payload.roomId);
        if (!room) {
          ack(fail("Room not active"));
          return;
        }

        if (room.status !== "PLAYING") {
          ack(fail("Game is not in PLAYING state"));
          return;
        }

        const playerId = socket.data.user.sub;
        let over: GameOverPayload | undefined;

        if (payload.gameType === "chess" && room.state.gameType === "chess") {
          const result = applyChessMove(room.state, payload, playerId, Date.now());
          if (!result.ok) {
            ack(fail(result.error));
            return;
          }
          room.state = result.state;
          if (result.over) {
            room.status = "FINISHED";
            over = { roomId: room.id, winnerId: result.over.winnerId, reason: result.over.reason };
          }
        } else if (payload.gameType === "checkers" && room.state.gameType === "checkers") {
          const result = applyCheckersMove(room.state, payload, playerId);
          if (!result.ok) {
            ack(fail(result.error));
            return;
          }
          room.state = result.state;
          if (result.over) {
            room.status = "FINISHED";
            over = { roomId: room.id, winnerId: result.over.winnerId, reason: result.over.reason };
          }
        } else if (payload.gameType === "durak" && room.state.gameType === "durak") {
          const result = applyDurakMove(room.state, payload, playerId);
          if (!result.ok) {
            ack(fail(result.error));
            return;
          }
          room.state = result.state;
          if (result.over) {
            room.status = "FINISHED";
            over = { roomId: room.id, winnerId: result.over.winnerId, reason: result.over.reason };
          }
        } else if (payload.gameType === "alias" && room.state.gameType === "alias") {
          const result = applyAliasMove(room.state, payload, playerId, Date.now());
          if (!result.ok) {
            ack(fail(result.error));
            return;
          }
          room.state = result.state;
          if (result.over) {
            room.status = "FINISHED";
            over = { roomId: room.id, winnerId: result.over.winnerId, reason: result.over.reason };
          }
        } else if (payload.gameType === "mafia" && room.state.gameType === "mafia") {
          const result = applyMafiaMove(room.state, payload, playerId);
          if (!result.ok) {
            ack(fail(result.error));
            return;
          }
          room.state = result.state;
          if (result.over) {
            room.status = "FINISHED";
            over = { roomId: room.id, winnerId: result.over.winnerId, reason: result.over.reason };
          }
        } else {
          ack(fail("Move payload does not match room game type"));
          return;
        }

        room.updatedAt = nowIso();
        emitGameState(namespace, room);

        if (over) {
          await prisma.room.update({ where: { id: room.id }, data: { status: "FINISHED" } });
          namespace.to(room.id).emit("game:over", over);
          emitRoomUpdate(namespace, room);
        }

        ack(
          ok({
            roomId: room.id,
            state: toClientGameState(room, playerId),
            ...(over ? { over } : {})
          })
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to apply move";
        ack(fail(message));
      }
    });

    socket.on("chat:message", (payload: ChatMessagePayload, ack) => {
      const room = getRoom(payload.roomId);
      if (!room) {
        ack(fail("Room not active"));
        return;
      }

      const text = payload.text.trim();
      if (text.length === 0 || text.length > 300) {
        ack(fail("Message length must be between 1 and 300"));
        return;
      }

      const player = room.players.find((p) => p.userId === socket.data.user.sub);
      if (!player) {
        ack(fail("User is not in room"));
        return;
      }

      const message: ChatMessage = {
        id: randomUUID(),
        roomId: room.id,
        userId: player.userId,
        username: player.username,
        text,
        createdAt: nowIso()
      };

      room.chat.push(message);
      if (room.chat.length > config.roomChatLimit) {
        room.chat.splice(0, room.chat.length - config.roomChatLimit);
      }

      room.updatedAt = nowIso();
      namespace.to(room.id).emit("chat:message", message);
      ack(ok({ message }));
    });

    socket.on("disconnect", () => {
      const userId = socket.data.user.sub;

      for (const roomId of socket.data.joinedRooms) {
        const room = getRoom(roomId);
        if (!room) continue;

        if (room.status === "WAITING") {
          if (hasOtherConnectedSocketForUser(namespace, room.id, userId, socket.id)) {
            continue;
          }

          const player = room.players.find((p) => p.userId === userId);
          if (!player) continue;

          player.connected = false;
          room.updatedAt = nowIso();

          namespace.to(room.id).emit("player:disconnected", {
            roomId: room.id,
            userId,
            reconnectDeadlineMs: Date.now() + config.reconnectTimeoutMs
          });

          emitRoomUpdate(namespace, room);

          const existingTimer = room.disconnectTimers.get(userId);
          if (existingTimer) clearTimeout(existingTimer);

          const timer = setTimeout(async () => {
            const staleRoom = getRoom(room.id);
            if (!staleRoom) return;

            const stalePlayer = staleRoom.players.find((p) => p.userId === userId);
            if (!stalePlayer || stalePlayer.connected) return;
            if (staleRoom.status !== "WAITING") return;

            if (staleRoom.hostId === userId) {
              await closeWaitingRoomByHostLeave(prisma, namespace, staleRoom, "Host disconnected. Room is closed.");
              return;
            }

            const result = await removeMemberFromWaitingRoom(prisma, staleRoom, userId);
            if (!result.roomDeleted) {
              emitRoomUpdate(namespace, staleRoom);
            }
          }, config.reconnectTimeoutMs);

          room.disconnectTimers.set(userId, timer);
          continue;
        }

        if (room.status === "PLAYING") {
          if (hasOtherConnectedSocketForUser(namespace, room.id, userId, socket.id)) {
            continue;
          }

          const player = room.players.find((p) => p.userId === userId);
          if (!player) continue;

          player.connected = false;
          room.updatedAt = nowIso();

          namespace.to(room.id).emit("player:disconnected", {
            roomId: room.id,
            userId,
            reconnectDeadlineMs: Date.now() + config.reconnectTimeoutMs
          });

          emitRoomUpdate(namespace, room);

          const existingTimer = room.disconnectTimers.get(userId);
          if (existingTimer) clearTimeout(existingTimer);

          const timer = setTimeout(async () => {
            const staleRoom = getRoom(room.id);
            if (!staleRoom) return;

            const stalePlayer = staleRoom.players.find((p) => p.userId === userId);
            if (!stalePlayer || stalePlayer.connected) return;

            if (staleRoom.status === "PLAYING") {
              await finishPlayingRoomByForfeit(prisma, namespace, staleRoom, userId, "abandoned");
            }
          }, config.reconnectTimeoutMs);

          room.disconnectTimers.set(userId, timer);
          continue;
        }
      }
    });
  });

  return {
    io: namespace,
    closeRoom
  };
}
