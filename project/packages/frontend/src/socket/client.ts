import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ChatMessage,
  ChatMessagePayload,
  ClientToServerEvents,
  GameMovePayload,
  GameOverPayload,
  GameState,
  PlayerDisconnectedPayload,
  PlayerReconnectedPayload,
  RoomJoinPayload,
  RoomReadyPayload,
  RoomRuntimeState,
  ServerToClientEvents
} from "@board-games/shared";
import { SOCKET_NAMESPACE } from "@board-games/shared";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { translateServerMessage } from "../lib/i18n";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_RETRY_MESSAGE = "Соединение нестабильно. Идет переподключение, попробуйте снова.";
const TRANSIENT_SOCKET_ERROR_PATTERNS: RegExp[] = [
  /connection is unstable/i,
  /соединение нестабильно/i,
  /socket connection timeout/i,
  /тайм-аут подключения к сокету/i,
  /socket connection failed/i,
  /не удалось подключиться к сокету/i,
  /socket disconnected/i,
  /соединение с сокетом разорвано/i,
  /before acknowledgment/i,
  /transport close/i,
  /xhr poll error/i,
  /websocket error/i,
  /timeout/i,
  /тайм-аут/i,
  /reconnect/i,
  /переподключ/i,
  /network/i
];

const API_URL = resolveApiBaseUrl();
let socketSingleton: ClientSocket | null = null;

function socketEndpoint(): string {
  const base = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
  return `${base}${SOCKET_NAMESPACE}`;
}

function ensureSocket(): ClientSocket {
  if (!socketSingleton) {
    socketSingleton = io(socketEndpoint(), {
      withCredentials: true,
      transports: ["polling", "websocket"],
      autoConnect: false,
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000
    });
  }
  return socketSingleton;
}

function waitForSocketConnection(socket: ClientSocket, timeoutMs = 7000): Promise<string | null> {
  if (socket.connected) {
    return Promise.resolve(null);
  }

  socket.connect();

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve("Тайм-аут подключения к сокету.");
    }, timeoutMs);

    const onConnect = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(null);
    };

    const onConnectError = (error: Error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(translateServerMessage(error.message || "Не удалось подключиться к сокету."));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
  });
}

async function emitWithAck<TPayload, TData>(
  event: keyof ClientToServerEvents,
  payload: TPayload
): Promise<Ack<TData>> {
  const socket = ensureSocket();

  const connectionError = await waitForSocketConnection(socket);
  if (connectionError) {
    return { ok: false, error: translateServerMessage(connectionError) };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      socket.connect();
      resolve({ ok: false, error: SOCKET_RETRY_MESSAGE });
    }, 12000);

    const onDisconnect = (reason: string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      socket.connect();
      resolve({ ok: false, error: `${SOCKET_RETRY_MESSAGE} (${reason})` });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("disconnect", onDisconnect);
    };

    const ack = (response: Ack<TData>) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(response);
    };

    socket.on("disconnect", onDisconnect);

    const emit = socket.emit.bind(socket) as unknown as (
      eventName: string,
      eventPayload: TPayload,
      callback: (response: Ack<TData>) => void
    ) => void;
    emit(String(event), payload, ack);
  });
}

export function connectSocket(): ClientSocket {
  const socket = ensureSocket();
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (!socketSingleton) return;
  socketSingleton.removeAllListeners();
  socketSingleton.disconnect();
  socketSingleton = null;
}

export function isTransientSocketIssue(message: string): boolean {
  return TRANSIENT_SOCKET_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getSocket(): ClientSocket {
  return ensureSocket();
}

export function joinRoom(payload: RoomJoinPayload): Promise<Ack<{ room: RoomRuntimeState }>> {
  return emitWithAck<RoomJoinPayload, { room: RoomRuntimeState }>("room:join", payload);
}

export function leaveRoom(roomId: string): Promise<Ack<{ roomId: string }>> {
  return emitWithAck<{ roomId: string }, { roomId: string }>("room:leave", { roomId });
}

export function setReady(payload: RoomReadyPayload): Promise<Ack<{ roomId: string; ready: boolean }>> {
  return emitWithAck<RoomReadyPayload, { roomId: string; ready: boolean }>("room:ready", payload);
}

export function startRoom(roomId: string): Promise<Ack<{ roomId: string; status: string }>> {
  return emitWithAck<{ roomId: string }, { roomId: string; status: string }>("room:start", { roomId });
}

export function emitGameMove(
  payload: GameMovePayload
): Promise<Ack<{ roomId: string; state: GameState; over?: GameOverPayload }>> {
  return emitWithAck<GameMovePayload, { roomId: string; state: GameState; over?: GameOverPayload }>(
    "game:move",
    payload
  );
}

export function emitChatMessage(payload: ChatMessagePayload): Promise<Ack<{ message: ChatMessage }>> {
  return emitWithAck<ChatMessagePayload, { message: ChatMessage }>("chat:message", payload);
}

export function onRoomJoined(handler: (payload: { room: RoomRuntimeState; selfId: string }) => void): () => void {
  const socket = ensureSocket();
  socket.on("room:joined", handler);
  return () => socket.off("room:joined", handler);
}

export function onRoomUpdate(
  handler: (payload: { roomId: string; status: string; players: RoomRuntimeState["players"] }) => void
): () => void {
  const socket = ensureSocket();
  const wrapped = (payload: { roomId: string; status: string; players: RoomRuntimeState["players"] }) => {
    handler(payload);
  };
  socket.on("room:update", wrapped);
  return () => socket.off("room:update", wrapped);
}

export function onGameState(handler: (payload: { roomId: string; state: GameState }) => void): () => void {
  const socket = ensureSocket();
  socket.on("game:state", handler);
  return () => socket.off("game:state", handler);
}

export function onGameOver(handler: (payload: GameOverPayload) => void): () => void {
  const socket = ensureSocket();
  socket.on("game:over", handler);
  return () => socket.off("game:over", handler);
}

export function onChatMessage(handler: (payload: ChatMessage) => void): () => void {
  const socket = ensureSocket();
  socket.on("chat:message", handler);
  return () => socket.off("chat:message", handler);
}

export function onPlayerDisconnected(handler: (payload: PlayerDisconnectedPayload) => void): () => void {
  const socket = ensureSocket();
  socket.on("player:disconnected", handler);
  return () => socket.off("player:disconnected", handler);
}

export function onPlayerReconnected(handler: (payload: PlayerReconnectedPayload) => void): () => void {
  const socket = ensureSocket();
  socket.on("player:reconnected", handler);
  return () => socket.off("player:reconnected", handler);
}

export function onSocketError(handler: (message: string) => void): () => void {
  const socket = ensureSocket();

  const serverError = (payload: { message: string }) => handler(translateServerMessage(payload.message));
  const connectError = (error: Error) => handler(translateServerMessage(error.message));
  const disconnect = (reason: string) => handler(`Сокет отключен: ${translateServerMessage(reason)}`);

  socket.on("server:error", serverError);
  socket.on("connect_error", connectError);
  socket.on("disconnect", disconnect);

  return () => {
    socket.off("server:error", serverError);
    socket.off("connect_error", connectError);
    socket.off("disconnect", disconnect);
  };
}
