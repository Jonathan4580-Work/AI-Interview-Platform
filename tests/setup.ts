Object.assign(process.env, {
  NODE_ENV: "test",
  APP_NAME: "Aptly Test",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://aptly:aptly@localhost:5432/aptly_test?schema=public",
  DIRECT_DATABASE_URL: "postgresql://aptly:aptly@localhost:5432/aptly_test?schema=public",
  REDIS_URL: "redis://localhost:6379/1",
  REQUEST_ID_HEADER: "x-request-id",
  CORRELATION_ID_HEADER: "x-correlation-id",
  SMTP_SECRET_REF: "test/smtp",
  OBJECT_STORAGE_SECRET_REF: "test/object-storage",
});
