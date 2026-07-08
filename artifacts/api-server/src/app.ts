import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttpModule from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

type MiddlewareFactory = (options?: Record<string, unknown>) => RequestHandler;

const pinoHttp = pinoHttpModule as unknown as MiddlewareFactory;
const helmetMiddleware = helmet as unknown as MiddlewareFactory;
const app: Express = express();


// Behind Replit's reverse proxy. Trust the first hop so secure-cookie detection
// works and express-rate-limit keys off the real client IP (X-Forwarded-For).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Request) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Response) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers. crossOriginResourcePolicy is relaxed to "cross-origin" so
// images streamed from /api/storage/* can be displayed by the frontend and the
// Replit preview iframe.
app.use(
  helmetMiddleware({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS locked to an explicit allowlist: CORS_ORIGIN (comma-separated, for custom
// domains) plus the platform-provided REPLIT_DOMAINS, which covers both the
// development preview and the published production domain automatically.
const allowedOrigins = new Set<string>();
for (const origin of (process.env.CORS_ORIGIN ?? "").split(",")) {
  const trimmed = origin.trim();
  if (trimmed) allowedOrigins.add(trimmed);
}
for (const domain of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
  const trimmed = domain.trim();
  if (trimmed) allowedOrigins.add(`https://${trimmed}`);
}

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin requests and non-browser clients (curl, health probes) send
      // no Origin header — always allow those. Otherwise require an allowlist
      // match; a non-match simply omits CORS headers so the browser blocks it.
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting. Auth endpoints get a stricter window to slow brute-force and
// login abuse; every other API route gets a general per-IP limit. The health
// check is exempted so platform probes are never throttled.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.originalUrl.split("?")[0] === "/api/healthz",
  message: { error: "Too many requests, please try again later" },
});

app.use("/api", apiLimiter);
app.use(["/api/login", "/api/callback", "/api/logout"], authLimiter);

app.use(authMiddleware);

app.use("/api", router);

// Global error handler. Must be registered last, after the router. Express 5
// forwards rejected async handlers here automatically. The full error is logged
// server-side, but the client only ever receives a generic message — no stack
// traces or internals are leaked.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  req.log.error({ err }, "Unhandled error in request pipeline");
  if (res.headersSent) {
    next(err);
    return;
  }
  // Honor client-error statuses (e.g. malformed JSON from express.json throws a
  // 400) but never leak internals for genuine server errors.
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error)?.message || "Bad Request" });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
