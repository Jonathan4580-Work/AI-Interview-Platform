import IORedis from "ioredis";

import { env } from "@/config";

const globalForRedis = globalThis as unknown as {
  redis?: IORedis;
};

export const redis =
  globalForRedis.redis ??
  new IORedis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: null,
  });

redis.on("error", () => {
  // Redis availability is reported through readiness checks and command failures.
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
