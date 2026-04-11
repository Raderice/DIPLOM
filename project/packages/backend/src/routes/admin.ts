import { Router, type Response } from "express";
import type { RuntimeRoom } from "../store/gameStore";
import { requireAdmin, requireAuth, type AuthRequest } from "../middleware/auth";

type ForceCloseRoomFn = (roomId: string, reason?: string) => Promise<void>;

export function createAdminRouter(
  roomMap: Map<string, RuntimeRoom>,
  forceCloseRoom: ForceCloseRoomFn
): Router {
  const router = Router();

  router.get("/rooms", requireAuth, requireAdmin, (req: AuthRequest, res: Response) => {
    const rows = Array.from(roomMap.values()).map((room) => ({
      id: room.id,
      game: room.gameType,
      players: room.players.length,
      status: room.status,
      created_at: room.createdAt
    }));

    res.status(200).json(rows);
  });

  router.post("/rooms/:roomId/force-close", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    await forceCloseRoom(req.params.roomId, "force-closed-by-admin");
    res.status(200).json({ ok: true, roomId: req.params.roomId });
  });

  return router;
}
