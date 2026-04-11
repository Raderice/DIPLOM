export const SOCKET_NAMESPACE = "/realtime" as const;

export const SOCKET_EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_READY: "room:ready",
  ROOM_START: "room:start",
  GAME_MOVE: "game:move",
  GAME_STATE: "game:state",
  GAME_OVER: "game:over",
  CHAT_MESSAGE: "chat:message",
  PLAYER_DISCONNECTED: "player:disconnected",
  PLAYER_RECONNECTED: "player:reconnected",
  ROOM_JOINED: "room:joined",
  ROOM_UPDATED: "room:update",
  SERVER_ERROR: "server:error",
  ADMIN_ROOMS: "admin:rooms"
} as const;

export type Role = "user" | "admin";
export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";
export type GameType = "chess" | "checkers" | "durak";
export type ISODateString = string;

export interface JwtUserClaims {
  sub: string;
  username: string;
  email: string;
  role: Role;
  tokenVersion: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: Role;
}

export interface PlayerInRoom {
  userId: string;
  username: string;
  role: Role;
  ready: boolean;
  connected: boolean;
  joinedAt: ISODateString;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: ISODateString;
}

export interface BaseGameState {
  gameType: GameType;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ChessColor = "w" | "b";

export interface ChessState extends BaseGameState {
  gameType: "chess";
  fen: string;
  turn: ChessColor;
  colorByPlayerId: Record<string, ChessColor>;
  clocksMs: Record<string, number>;
  lastMoveAtMs: number;
  moveHistory: string[];
  winnerId: string | null;
  reason: string | null;
}

export type CheckersColor = "white" | "black";

export interface CheckersPiece {
  id: string;
  ownerId: string;
  color: CheckersColor;
  isKing: boolean;
}

export type CheckersCell = CheckersPiece | null;

export interface CheckersState extends BaseGameState {
  gameType: "checkers";
  board: CheckersCell[][];
  turnPlayerId: string;
  colorByPlayerId: Record<string, CheckersColor>;
  mandatoryCapture: boolean;
  moveCount: number;
  winnerId: string | null;
  reason: string | null;
}

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export type DurakPhase = "attack" | "defend";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface DurakPlayerState {
  userId: string;
  username: string;
  hand: Card[];
}

export interface DurakPlayerPublic {
  userId: string;
  username: string;
  handCount: number;
  isSelf: boolean;
}

export interface DurakAttackPair {
  id: string;
  attack: Card;
  defense: Card | null;
  attackerId: string;
  defenderId: string;
}

export interface DurakState extends BaseGameState {
  gameType: "durak";
  deck: Card[];
  trumpSuit: Suit;
  phase: DurakPhase;
  attackerId: string;
  defenderId: string;
  turnPlayerId: string;
  players: DurakPlayerState[];
  table: DurakAttackPair[];
  discard: Card[];
  winnerIds: string[];
  loserId: string | null;
  reason: string | null;
}

export interface DurakPlayerViewState extends BaseGameState {
  gameType: "durak";
  deckCount: number;
  trumpSuit: Suit;
  phase: DurakPhase;
  attackerId: string;
  defenderId: string;
  turnPlayerId: string;
  players: DurakPlayerPublic[];
  ownHand: Card[];
  table: DurakAttackPair[];
  discardCount: number;
  winnerIds: string[];
  loserId: string | null;
  reason: string | null;
}

export type GameState = ChessState | CheckersState | DurakPlayerViewState;
export type ServerGameState = ChessState | CheckersState | DurakState;

export interface RoomRuntimeState {
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
  state: GameState;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RoomListItem {
  id: string;
  name: string;
  gameType: GameType;
  status: RoomStatus;
  maxPlayers: number;
  currentPlayers: number;
  isPublic: boolean;
  inviteCode: string;
  createdAt: ISODateString;
}

export interface AdminRoomRow {
  id: string;
  gameType: GameType;
  players: number;
  status: RoomStatus;
  createdAt: ISODateString;
}

export interface RoomJoinPayload {
  roomId: string;
}

export interface RoomLeavePayload {
  roomId: string;
}

export interface RoomReadyPayload {
  roomId: string;
  ready: boolean;
}

export interface RoomStartPayload {
  roomId: string;
}

export interface ChessMovePayload {
  gameType: "chess";
  roomId: string;
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

export interface CheckersMovePayload {
  gameType: "checkers";
  roomId: string;
  from: [number, number];
  to: [number, number];
}

export interface DurakAttackPayload {
  gameType: "durak";
  roomId: string;
  action: "attack";
  cardId: string;
}

export interface DurakDefendPayload {
  gameType: "durak";
  roomId: string;
  action: "defend";
  cardId: string;
  targetPairId: string;
}

export interface DurakTakePayload {
  gameType: "durak";
  roomId: string;
  action: "take";
}

export interface DurakPassPayload {
  gameType: "durak";
  roomId: string;
  action: "pass";
}

export type DurakMovePayload =
  | DurakAttackPayload
  | DurakDefendPayload
  | DurakTakePayload
  | DurakPassPayload;

export type GameMovePayload = ChessMovePayload | CheckersMovePayload | DurakMovePayload;

export interface GameOverPayload {
  roomId: string;
  winnerId: string | null;
  reason: string;
}

export interface ChatMessagePayload {
  roomId: string;
  text: string;
}

export interface PlayerDisconnectedPayload {
  roomId: string;
  userId: string;
  reconnectDeadlineMs: number;
}

export interface PlayerReconnectedPayload {
  roomId: string;
  userId: string;
}

export type AckSuccess<T> = {
  ok: true;
  data: T;
};

export type AckError = {
  ok: false;
  error: string;
};

export type Ack<T> = AckSuccess<T> | AckError;

export interface ClientToServerEvents {
  "room:join": (payload: RoomJoinPayload, ack: (response: Ack<{ room: RoomRuntimeState }>) => void) => void;
  "room:leave": (payload: RoomLeavePayload, ack: (response: Ack<{ roomId: string }>) => void) => void;
  "room:ready": (payload: RoomReadyPayload, ack: (response: Ack<{ roomId: string; ready: boolean }>) => void) => void;
  "room:start": (payload: RoomStartPayload, ack: (response: Ack<{ roomId: string; status: RoomStatus }>) => void) => void;
  "game:move": (
    payload: GameMovePayload,
    ack: (response: Ack<{ roomId: string; state: GameState; over?: GameOverPayload }>) => void
  ) => void;
  "chat:message": (payload: ChatMessagePayload, ack: (response: Ack<{ message: ChatMessage }>) => void) => void;
}

export interface ServerToClientEvents {
  "room:joined": (payload: { room: RoomRuntimeState; selfId: string }) => void;
  "room:update": (payload: { roomId: string; status: RoomStatus; players: PlayerInRoom[] }) => void;
  "game:state": (payload: { roomId: string; state: GameState }) => void;
  "game:over": (payload: GameOverPayload) => void;
  "chat:message": (payload: ChatMessage) => void;
  "player:disconnected": (payload: PlayerDisconnectedPayload) => void;
  "player:reconnected": (payload: PlayerReconnectedPayload) => void;
  "admin:rooms": (payload: AdminRoomRow[]) => void;
  "server:error": (payload: { message: string }) => void;
}

export interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: PublicUser;
}

export interface CreateRoomBody {
  name: string;
  gameType: GameType;
  maxPlayers: number;
  isPublic: boolean;
}

export interface JoinByCodeBody {
  inviteCode: string;
}
