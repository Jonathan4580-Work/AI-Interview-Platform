import pino from "pino";

import { env } from "@/config";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "DATABASE_URL",
      "REDIS_URL",
      "*.token",
      "*.tokenHash",
      "*.authorization",
      "*.cookie",
      "*.password",
      "*.secret",
      "*.secretRef",
      "*.signedUrl",
    ],
    censor: "[redacted]",
  },
});
