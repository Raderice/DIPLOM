import type { ChatMessage, PlayerInRoom, ServerGameState, GameType, RoomStatus } from "@board-games/shared";

export interface RuntimeRoom {
  id: string;
  name: string;
  gameType: GameType;
  status: RoomStatus;
  hostId: string;
  maxPlayers: number;
  isPublic: boolean;
  inviteCode: string;
  players: PlayerInRoom[];
  chat: ChatMessage[];
  state: ServerGameState;
  createdAt: string;
  updatedAt: string;
  disconnectTimers: Map<string, NodeJS.Timeout>;
}

const rooms = new Map<string, RuntimeRoom>();

export function getRoom(roomId: string): RuntimeRoom | undefined {
  return rooms.get(roomId);
}

export function getAllRooms(): RuntimeRoom[] {
  return Array.from(rooms.values());
}

export function setRoom(room: RuntimeRoom): void {
  rooms.set(room.id, room);
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    for (const timer of room.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    room.disconnectTimers.clear();
  }
  rooms.delete(roomId);
}

export function roomCount(): number {
  return rooms.size;
}

export function roomStore(): Map<string, RuntimeRoom> {
  return rooms;
}
