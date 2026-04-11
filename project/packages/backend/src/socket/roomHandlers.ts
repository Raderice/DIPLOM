import type { GameState, RoomRuntimeState } from "@board-games/shared";
import type { RuntimeRoom } from "../store/gameStore";
import { sanitizeDurakStateForPlayer } from "./games/durak";

export function parseCookie(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function toClientGameState(room: RuntimeRoom, viewerId: string): GameState {
  if (room.state.gameType === "durak") {
    return sanitizeDurakStateForPlayer(room.state, viewerId);
  }
  return room.state;
}

export function toClientRoom(room: RuntimeRoom, viewerId: string): RoomRuntimeState {
  return {
    id: room.id,
    name: room.name,
    gameType: room.gameType,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    isPublic: room.isPublic,
    inviteCode: room.inviteCode,
    players: room.players,
    chat: room.chat,
    state: toClientGameState(room, viewerId),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}
