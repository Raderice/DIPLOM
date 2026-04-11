import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { JwtUserClaims } from "@board-games/shared";
import { config } from "../config";

export function signAccessToken(claims: JwtUserClaims): string {
  return jwt.sign(claims, config.jwtAccessSecret, {
    expiresIn: `${config.accessTokenTtlMin}m`
  });
}

export function signRefreshToken(claims: JwtUserClaims): string {
  return jwt.sign(claims, config.jwtRefreshSecret, {
    expiresIn: `${config.refreshTokenTtlDays}d`,
    jwtid: randomUUID()
  });
}

function toClaims(payload: JwtPayload): JwtUserClaims {
  return {
    sub: String(payload.sub),
    username: String(payload.username),
    email: String(payload.email),
    role: payload.role === "admin" ? "admin" : "user",
    tokenVersion: Number(payload.tokenVersion ?? 0)
  };
}

export function verifyAccessToken(token: string): JwtUserClaims {
  const decoded = jwt.verify(token, config.jwtAccessSecret);
  if (typeof decoded !== "object" || decoded === null || !("sub" in decoded)) {
    throw new Error("Invalid access token");
  }
  return toClaims(decoded as JwtPayload);
}

export function verifyRefreshToken(token: string): JwtUserClaims {
  const decoded = jwt.verify(token, config.jwtRefreshSecret);
  if (typeof decoded !== "object" || decoded === null || !("sub" in decoded)) {
    throw new Error("Invalid refresh token");
  }
  return toClaims(decoded as JwtPayload);
}
