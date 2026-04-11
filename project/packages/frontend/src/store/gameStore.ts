import { create } from "zustand";
import type { ChatMessage, GameState, PlayerInRoom, RoomRuntimeState, RoomStatus } from "@board-games/shared";

interface GameStoreState {
  room: RoomRuntimeState | null;
  gameState: GameState | null;
  chat: ChatMessage[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRoom: (room: RoomRuntimeState) => void;
  setPlayers: (roomId: string, status: RoomStatus, players: PlayerInRoom[]) => void;
  setGameState: (state: GameState) => void;
  pushChatMessage: (message: ChatMessage) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  gameState: null,
  chat: [],
  connected: false,
  loading: false,
  error: null
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setRoom: (room) =>
    set(() => ({
      room,
      gameState: room.state,
      chat: room.chat
    })),

  setPlayers: (roomId, status, players) =>
    set((state) => {
      if (!state.room || state.room.id !== roomId) return state;
      return {
        ...state,
        room: {
          ...state.room,
          status,
          players
        }
      };
    }),

  setGameState: (state) =>
    set((prev) => ({
      ...prev,
      gameState: state,
      room: prev.room
        ? {
            ...prev.room,
            state
          }
        : prev.room
    })),

  pushChatMessage: (message) =>
    set((state) => {
      const next = [...state.chat, message];
      const cropped = next.length > 50 ? next.slice(next.length - 50) : next;
      return {
        ...state,
        chat: cropped,
        room: state.room
          ? {
              ...state.room,
              chat: cropped
            }
          : state.room
      };
    }),

  reset: () => set({ ...initialState })
}));
