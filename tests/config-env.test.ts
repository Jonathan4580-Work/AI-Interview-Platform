import { describe, expect, it } from "vitest";

import { loadEnvironment } from "@/config";

describe("environment validation", () => {
  it("allows local development defaults without production secrets", () => {
    expect(
      loadEnvironment(baseEnv({ NODE_ENV: "development", APP_ENV: "development" })),
    ).toMatchObject({
      NODE_ENV: "development",
      APP_ENV: "development",
      APP_URL: "http://localhost:3000",
      EVALUATION_PROVIDER: "development",
    });
  });

  it("fails closed when APP_ENV is missing", () => {
    const withoutAppEnv = baseEnv({ NODE_ENV: "production" });
    delete withoutAppEnv.APP_ENV;

    expect(() => loadEnvironment(withoutAppEnv)).toThrow();
  });

  it("accepts Railway staging private Postgres and Redis URLs with deployed security settings", () => {
    expect(loadEnvironment(stagingEnv())).toMatchObject({
      NODE_ENV: "production",
      APP_ENV: "staging",
      APP_URL: "https://aptly-staging.up.railway.app",
      DATABASE_URL: "postgresql://postgres:secret@postgres.railway.internal:5432/railway",
      REDIS_URL: "redis://default:secret@redis.railway.internal:6379",
    });
  });

  it("rejects HTTP public URLs in staging", () => {
    expect(() =>
      loadEnvironment(stagingEnv({ APP_URL: "http://aptly-staging.up.railway.app" })),
    ).toThrow();
  });

  it("rejects non-managed secret references in staging", () => {
    expect(() => loadEnvironment(stagingEnv({ SESSION_SECRET_REF: "staging/session" }))).toThrow();
  });

  it("fails closed when production security configuration is missing or insecure", () => {
    expect(() =>
      loadEnvironment(
        baseEnv({
          NODE_ENV: "production",
          APP_ENV: "production",
          APP_URL: "http://app.example.com",
          REDIS_URL: "redis://redis.example.com:6379",
          DATABASE_URL: "postgresql://user:pass@postgres.example.com:5432/aptly?schema=public",
        }),
      ),
    ).toThrow();
  });

  it("rejects non-TLS PostgreSQL in production", () => {
    expect(() =>
      loadEnvironment(
        productionEnv({
          DATABASE_URL: "postgresql://runtime:secret@postgres.example.com:5432/aptly?schema=public",
        }),
      ),
    ).toThrow();
  });

  it("rejects redis:// in production", () => {
    expect(() =>
      loadEnvironment(
        productionEnv({
          REDIS_URL: "redis://:secret@redis.example.com:6379",
        }),
      ),
    ).toThrow();
  });

  it("accepts production configuration that uses TLS and managed secret references", () => {
    expect(loadEnvironment(productionEnv())).toMatchObject({
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_URL: "https://app.example.com",
      REDIS_URL: "rediss://:secret@redis.example.com:6379",
      SMTP_SECRET_REF: "secret://production/aptly/smtp",
    });
  });
});

function baseEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APP_ENV: "test",
    APP_NAME: "Aptly Test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://aptly:aptly@localhost:5432/aptly_test?schema=public",
    REDIS_URL: "redis://localhost:6379/1",
    SMTP_SECRET_REF: "test/smtp",
    OBJECT_STORAGE_SECRET_REF: "test/object-storage",
    ...overrides,
  };
}

function stagingEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return baseEnv({
    NODE_ENV: "production",
    APP_ENV: "staging",
    APP_URL: "https://aptly-staging.up.railway.app",
    CANDIDATE_APP_URL: "https://candidate-staging.up.railway.app",
    INTERNAL_APP_URL: "https://aptly-staging.up.railway.app",
    DATABASE_URL: "postgresql://postgres:secret@postgres.railway.internal:5432/railway",
    REDIS_URL: "redis://default:secret@redis.railway.internal:6379",
    SESSION_SECRET_REF: "secret://staging/aptly/session",
    CSRF_SECRET_REF: "secret://staging/aptly/csrf",
    TOKEN_PEPPER_SECRET_REF: "secret://staging/aptly/token-pepper",
    ENCRYPTION_KEY_SECRET_REF: "secret://staging/aptly/encryption",
    SMTP_SECRET_REF: "secret://staging/aptly/smtp",
    SMTP_FROM_EMAIL: "no-reply@example.com",
    SMTP_REPLY_TO_EMAIL: "support@example.com",
    OBJECT_STORAGE_SECRET_REF: "secret://staging/aptly/object-storage",
    BACKUP_STORAGE_SECRET_REF: "secret://staging/aptly/backups",
    ...overrides,
  });
}

function productionEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return baseEnv({
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_URL: "https://app.example.com",
    CANDIDATE_APP_URL: "https://interview.example.com",
    INTERNAL_APP_URL: "https://app.example.com",
    DATABASE_URL:
      "postgresql://runtime:secret@postgres.example.com:5432/aptly?schema=public&sslmode=require",
    REDIS_URL: "rediss://:secret@redis.example.com:6379",
    SESSION_SECRET_REF: "secret://production/aptly/session",
    CSRF_SECRET_REF: "secret://production/aptly/csrf",
    TOKEN_PEPPER_SECRET_REF: "secret://production/aptly/token-pepper",
    ENCRYPTION_KEY_SECRET_REF: "secret://production/aptly/encryption",
    SMTP_SECRET_REF: "secret://production/aptly/smtp",
    SMTP_FROM_EMAIL: "no-reply@example.com",
    SMTP_REPLY_TO_EMAIL: "support@example.com",
    OBJECT_STORAGE_SECRET_REF: "secret://production/aptly/object-storage",
    BACKUP_STORAGE_SECRET_REF: "secret://production/aptly/backups",
    ...overrides,
  });
}
