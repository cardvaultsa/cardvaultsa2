import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  ensureAuthTables,
  getAllowedOwnerUserId,
  getAuthConfigError,
  isPasswordAuthEnabled,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  getPasswordAuthUserId,
  type SessionData,
} from "../lib/auth";
import { recordSecurityAudit } from "../lib/auditLog";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPasswordLoginPage(returnTo: string, error?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>PokeVault Login</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #090d14; color: #eef4f1; }
      main { width: min(360px, calc(100vw - 40px)); }
      h1 { color: #34d399; font-size: 42px; margin: 0 0 8px; }
      p { color: #94a3b8; line-height: 1.5; }
      form { display: grid; gap: 14px; margin-top: 28px; }
      input, button { border: 0; border-radius: 10px; font: inherit; padding: 14px 16px; }
      input { background: #111827; color: #fff; outline: 1px solid #253041; }
      button { background: #34d399; color: #04130e; font-weight: 700; }
      .error { color: #f87171; }
    </style>
  </head>
  <body>
    <main>
      <h1>PokeVault</h1>
      <p>Enter the admin password configured in Vercel.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/api/login">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <input type="password" name="password" autocomplete="current-password" placeholder="Admin password" required autofocus />
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
}

function renderAuthConfigPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Auth not configured</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 32px;">
    <h1>Authentication is not configured</h1>
    <p>${escapeHtml(message)}</p>
  </body>
</html>`;
}

function describeDatabaseSetupError(error: unknown): string {
  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_PRISMA_URL,
  );

  if (!hasDatabaseUrl) {
    return "No database connection env var is available at runtime. Link Postgres to this Vercel project for Production and redeploy.";
  }

  const details = error as { code?: unknown; message?: unknown };
  const code = typeof details.code === "string" ? details.code : null;
  const message =
    typeof details.message === "string"
      ? details.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]")
      : "Unknown database error";

  if (code === "28P01") return "Database rejected the username or password.";
  if (code === "3D000") return "The configured database name does not exist.";
  if (code === "42501") return "The database user does not have permission to create or write tables.";
  if (code === "42P01") return "A required database table is missing and could not be created.";
  if (code === "42704") return "A required database type is missing and could not be created.";
  if (code === "ENOTFOUND") return "The database host could not be found from Vercel.";
  if (code === "ECONNREFUSED") return "Vercel could reach the database host, but the connection was refused.";
  if (code === "ETIMEDOUT") return "The database connection timed out from Vercel.";

  return `${code ? `${code}: ` : ""}${message}`;
}

async function upsertUser(claims: Record<string, unknown>) {
  await ensureAuthTables();

  const userData = {
    id: claims.sub as string,
    email: ((claims.email as string) || null) as string | null,
    firstName: ((claims.first_name as string) || null) as string | null,
    lastName: ((claims.last_name as string) || null) as string | null,
    profileImageUrl: ((claims.profile_image_url || claims.picture) as string | null) || null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  const rawUser = req.isAuthenticated() ? req.user : null;
  const user = rawUser
    ? {
        id: rawUser.id,
        email: rawUser.email ?? null,
        firstName: rawUser.firstName ?? null,
        lastName: rawUser.lastName ?? null,
        profileImageUrl: rawUser.profileImageUrl ?? null,
      }
    : null;
  res.json(GetCurrentAuthUserResponse.parse({ user }));
});

router.get("/login", async (req: Request, res: Response) => {
  const returnTo = getSafeReturnTo(req.query.returnTo);
  const passwordUserId = getPasswordAuthUserId();
  if (passwordUserId) {
    res.status(200).type("html").send(renderPasswordLoginPage(returnTo));
    return;
  }

  const authConfigError = getAuthConfigError();
  if (authConfigError) {
    res.status(503).type("html").send(renderAuthConfigPage(authConfigError));
    return;
  }

  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.post("/login", async (req: Request, res: Response) => {
  const passwordUserId = getPasswordAuthUserId();
  if (!passwordUserId) {
    res.status(404).json({ error: "Password login is not enabled" });
    return;
  }

  const returnTo = getSafeReturnTo(req.body?.returnTo);
  if (req.body?.password !== process.env.ADMIN_PASSWORD) {
    res.status(401).type("html").send(
      renderPasswordLoginPage(returnTo, "Incorrect password"),
    );
    return;
  }

  try {
    const dbUser = await upsertUser({
      sub: passwordUserId,
      email: process.env.ADMIN_EMAIL ?? null,
      first_name: "Owner",
      last_name: null,
      profile_image_url: null,
    });

    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email ?? null,
        firstName: dbUser.firstName ?? null,
        lastName: dbUser.lastName ?? null,
        profileImageUrl: dbUser.profileImageUrl ?? null,
      },
      access_token: "password",
      expires_at: Math.floor((Date.now() + SESSION_TTL) / 1000),
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    recordSecurityAudit(req, {
      event: "owner_sign_in",
      result: "success",
      userId: dbUser.id,
    });
    res.redirect(returnTo);
  } catch (error) {
    req.log.error({ err: error }, "Password login failed during database-backed session setup");
    res.status(503).type("html").send(
      renderAuthConfigPage(
        `Password accepted, but database session setup failed: ${describeDatabaseSetupError(error)}`,
      ),
    );
  }
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  // Owner allowlist: reject non-owner logins before creating a session or
  // writing to the users table, so a rejected account leaves no trace.
  const allowedUserId = getAllowedOwnerUserId();
  if (allowedUserId && (claims.sub as string) !== allowedUserId) {
    recordSecurityAudit(req, {
      event: "blocked_sign_in",
      result: "blocked",
      userId: (claims.sub as string) ?? null,
      reason: "not_owner_at_login",
    });
    res.redirect("/?error=access_denied");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email ?? null,
      firstName: dbUser.firstName ?? null,
      lastName: dbUser.lastName ?? null,
      profileImageUrl: dbUser.profileImageUrl ?? null,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  recordSecurityAudit(req, {
    event: "owner_sign_in",
    result: "success",
    userId: dbUser.id,
  });
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  if (isPasswordAuthEnabled()) {
    const sid = getSessionId(req);
    const userId = req.user?.id ?? null;
    await clearSession(res, sid);
    if (userId) {
      recordSecurityAudit(req, {
        event: "owner_sign_out",
        result: "success",
        userId,
      });
    }
    res.redirect("/");
    return;
  }

  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  const userId = req.user?.id ?? null;
  await clearSession(res, sid);

  // Only record a sign-out when an owner was actually signed in - an anonymous
  // hit to /logout is a no-op and shouldn't pollute the audit trail with a
  // "success" owner event that has no owner.
  if (userId) {
    recordSecurityAudit(req, {
      event: "owner_sign_out",
      result: "success",
      userId,
    });
  }

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

export default router;
