import type { NextFunction, Request, Response } from "express";
import type { JwtUserClaims } from "@board-games/shared";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: JwtUserClaims;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}
