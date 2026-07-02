import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("Worker healthcheck failed: REDIS_URL is not configured.");
  process.exit(1);
}

const redis = new Redis(redisUrl, {
  connectTimeout: 3_000,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: null,
});

try {
  await redis.connect();
  const response = await redis.ping();
  if (response !== "PONG") {
    console.error("Worker healthcheck failed: Redis did not return PONG.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Worker healthcheck failed.");
  process.exitCode = 1;
} finally {
  redis.disconnect();
}
