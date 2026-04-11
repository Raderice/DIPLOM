import dotenv from "dotenv";

dotenv.config();

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseProvider: process.env.DATABASE_PROVIDER ?? "postgresql",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://boardgames:boardgames@localhost:5432/boardgames?schema=public",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_me",
  accessTokenTtlMin: parseNumber(process.env.ACCESS_TOKEN_TTL_MIN, 15),
  refreshTokenTtlDays: parseNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  reconnectTimeoutMs: 60_000,
  roomChatLimit: 50
} as const;

const privateLanOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowed = config.clientOrigin.split(",").map((v) => v.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;

  if (privateLanOriginPattern.test(origin)) return true;

  if (config.nodeEnv !== "production") {
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }

  return false;
}
