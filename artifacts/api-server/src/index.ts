import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

export default app;

if (rawPort) {
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  if (!process.env.ALLOWED_USER_ID) {
    logger.warn(
      "ALLOWED_USER_ID is not set - owner allowlist is disabled. In development " +
        "any authenticated Replit user can access the app; in production all " +
        "authenticated access is denied until it is set.",
    );
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
} else {
  logger.info("PORT is not set; exporting app for serverless runtime");
}
