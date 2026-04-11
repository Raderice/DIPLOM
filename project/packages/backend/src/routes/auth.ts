import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { config } from "../config";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../utils/jwt";

const registerSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

function mapRole(role: string): "user" | "admin" {
  return role === "ADMIN" || role === "admin" ? "admin" : "user";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;

  return req.secure || (typeof forwardedProto === "string" && forwardedProto.split(",")[0]?.trim() === "https");
}

function setCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
  // In production behind plain HTTP (LAN), secure cookies would be dropped by browsers.
  const secure = config.nodeEnv === "production" ? isHttpsRequest(req) : false;
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: config.accessTokenTtlMin * 60 * 1000,
    path: "/"
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post("/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid register payload" });
      return;
    }

    const username = parsed.data.username.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      },
      select: { id: true }
    });

    if (exists) {
      res.status(409).json({ message: "User already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash
      }
    });

    const claims = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: mapRole(user.role),
      tokenVersion: user.tokenVersion
    } as const;

    const accessToken = signAccessToken(claims);
    const refreshToken = signRefreshToken(claims);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null
      }
    });

    setCookies(req, res, accessToken, refreshToken);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: mapRole(user.role)
      }
    });
  });

  router.post("/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid login payload" });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const claims = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: mapRole(user.role),
      tokenVersion: user.tokenVersion
    } as const;

    const accessToken = signAccessToken(claims);
    const refreshToken = signRefreshToken(claims);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null
      }
    });

    setCookies(req, res, accessToken, refreshToken);

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: mapRole(user.role)
      }
    });
  });

  router.post("/refresh", async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) {
      res.status(401).json({ message: "Missing refresh token" });
      return;
    }

    try {
      const claims = verifyRefreshToken(token);
      const tokenHash = hashToken(token);

      const existing = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!existing || existing.revokedAt || existing.expiresAt < new Date() || existing.userId !== claims.sub) {
        res.status(401).json({ message: "Refresh token invalid" });
        return;
      }

      const nextClaims = {
        sub: existing.user.id,
        username: existing.user.username,
        email: existing.user.email,
        role: mapRole(existing.user.role),
        tokenVersion: existing.user.tokenVersion
      } as const;

      const nextAccessToken = signAccessToken(nextClaims);
      const nextRefreshToken = signRefreshToken(nextClaims);

      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { tokenHash },
          data: { revokedAt: new Date() }
        }),
        prisma.refreshToken.create({
          data: {
            userId: existing.user.id,
            tokenHash: hashToken(nextRefreshToken),
            expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
            userAgent: req.headers["user-agent"] ?? null,
            ipAddress: req.ip ?? null
          }
        })
      ]);

      setCookies(req, res, nextAccessToken, nextRefreshToken);

      res.status(200).json({
        user: {
          id: existing.user.id,
          username: existing.user.username,
          email: existing.user.email,
          role: mapRole(existing.user.role)
        }
      });
    } catch {
      res.status(401).json({ message: "Refresh token invalid" });
    }
  });

  router.post("/logout", async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    clearCookies(res);
    res.status(200).json({ success: true });
  });

  router.get("/me", async (req: Request, res: Response) => {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const claims = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: claims.sub } });
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: mapRole(user.role)
        }
      });
    } catch {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  return router;
}
