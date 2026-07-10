import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, pool, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
export interface AuthUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

let oidcConfig: client.Configuration | null = null;
let authTablesReady: Promise<void> | null = null;

export function ensureAuthTables(): Promise<void> {
  authTablesReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY,
        "email" varchar UNIQUE,
        "first_name" varchar,
        "last_name" varchar,
        "profile_image_url" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar PRIMARY KEY,
        "sess" jsonb NOT NULL,
        "expire" timestamp NOT NULL
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");`,
    );
  })().catch((error) => {
    authTablesReady = null;
    throw error;
  });

  return authTablesReady;
}

export function isPasswordAuthEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD && process.env.AUTH_MODE !== "oidc";
}

export function getPasswordAuthUserId(): string | null {
  if (!isPasswordAuthEnabled()) {
    return null;
  }
  return process.env.ADMIN_USER_ID ?? process.env.ALLOWED_USER_ID ?? "owner";
}

export function getAllowedOwnerUserId(): string | null {
  return process.env.ALLOWED_USER_ID ?? getPasswordAuthUserId();
}

export function getAuthConfigError(): string | null {
  if (!process.env.REPL_ID && !isPasswordAuthEnabled()) {
    return "Set REPL_ID for Replit OIDC login, or set ADMIN_PASSWORD for Vercel password login.";
  }
  return null;
}

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    const replId = process.env.REPL_ID;
    if (!replId) {
      throw new Error(
        "REPL_ID must be set for Replit OIDC login. Set ADMIN_PASSWORD to use Vercel password login instead.",
      );
    }
    oidcConfig = await client.discovery(
      new URL(ISSUER_URL),
      replId,
    );
  }
  return oidcConfig;
}

export async function createSession(data: SessionData): Promise<string> {
  await ensureAuthTables();
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  await ensureAuthTables();
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await ensureAuthTables();
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await ensureAuthTables();
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
