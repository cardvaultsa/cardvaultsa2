import { type Request } from "express";

export type SecurityAuditEvent =
  | "owner_sign_in"
  | "owner_sign_out"
  | "blocked_sign_in";

export interface SecurityAuditEntry {
  event: SecurityAuditEvent;
  result: "success" | "blocked";
  userId?: string | null;
  reason?: string;
}

/**
 * Internal-only, structured security audit trail. Emits one JSON log line per
 * security-relevant authentication event (owner sign-in/out, blocked non-owner
 * sign-in). Each entry carries timestamp, event type, user id (when known),
 * source IP, user agent, and result.
 *
 * SECURITY: only the fields below are recorded. Never pass credentials (access
 * or refresh tokens, cookies), private file contents, or other secrets here.
 */
export function recordSecurityAudit(
  req: Request,
  entry: SecurityAuditEntry,
): void {
  req.log.info(
    {
      audit: "security",
      event: entry.event,
      result: entry.result,
      userId: entry.userId ?? null,
      sourceIp: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      reason: entry.reason ?? null,
      timestamp: new Date().toISOString(),
    },
    `security-audit:${entry.event}`,
  );
}
