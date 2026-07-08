import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import {
  type AuthUser,
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
} from "../lib/auth";
import { recordSecurityAudit } from "../lib/auditLog";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const refreshed = await refreshIfExpired(sid, session);
  if (!refreshed) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Owner allowlist. When ALLOWED_USER_ID is set, only that Replit account is
  // treated as authenticated; any other logged-in user is force-signed-out.
  // When it is unset we fail CLOSED in production (deny everyone) so a missing
  // config can never silently reopen the app to any Replit user; in development
  // we fail open so the app is never accidentally locked out while iterating.
  const allowedUserId = process.env.ALLOWED_USER_ID;
  if (!allowedUserId) {
    if (process.env.NODE_ENV === "production") {
      req.log.error(
        "ALLOWED_USER_ID is not set — denying authentication in production",
      );
      next();
      return;
    }
  } else if (refreshed.user.id !== allowedUserId) {
    recordSecurityAudit(req, {
      event: "blocked_sign_in",
      result: "blocked",
      userId: refreshed.user.id,
      reason: "not_owner_session",
    });
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = refreshed.user;
  next();
}
