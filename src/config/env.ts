import { z } from "zod";

const secretReferenceSchema = z
  .string()
  .min(1)
  .regex(
    /^(?:secret:\/\/)?[a-zA-Z0-9/_:.-]+$/,
    "Secret references must use stable secret-store identifiers.",
  );

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]),
    APP_NAME: z.string().min(1).default("Aptly"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    CANDIDATE_APP_URL: z.string().url().optional(),
    INTERNAL_APP_URL: z.string().url().optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().min(1),
    DIRECT_DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1),
    SESSION_SECRET_REF: secretReferenceSchema.optional(),
    CSRF_SECRET_REF: secretReferenceSchema.optional(),
    TOKEN_PEPPER_SECRET_REF: secretReferenceSchema.optional(),
    ENCRYPTION_KEY_SECRET_REF: secretReferenceSchema.optional(),
    REQUEST_ID_HEADER: z.string().min(1).default("x-request-id"),
    CORRELATION_ID_HEADER: z.string().min(1).default("x-correlation-id"),
    EMAIL_DELIVERY_MODE: z.enum(["preview", "smtp"]).default("preview"),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_SECURE: z.coerce.boolean().default(true),
    SMTP_FROM_EMAIL: z.string().email().optional(),
    SMTP_FROM_NAME: z.string().min(1).default("Aptly"),
    SMTP_REPLY_TO_EMAIL: z.string().email().optional(),
    SMTP_USERNAME: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECRET_REF: secretReferenceSchema,
    OBJECT_STORAGE_SECRET_REF: secretReferenceSchema,
    OBJECT_STORAGE_PROVIDER: z.enum(["s3", "minio"]).default("minio"),
    OBJECT_STORAGE_ENDPOINT: z.string().url().default("http://localhost:9000"),
    OBJECT_STORAGE_PUBLIC_ENDPOINT: z.string().url().default("http://localhost:9000"),
    OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
    OBJECT_STORAGE_BUCKET: z.string().min(3).max(63).default("aptly-media-dev"),
    OBJECT_STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    OBJECT_STORAGE_CORS_ALLOWED_ORIGINS: z.string().min(1).optional(),
    WORKER_ORCHESTRATION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    WORKER_MEDIA_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(3),
    WORKER_PROVIDER_BOUND_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_NOTIFICATIONS_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    WORKER_TRANSCRIPTION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_EVALUATION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_REPORTING_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(3),
    WORKER_EXPORTS_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_RETENTION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_INTEGRATIONS_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    WORKER_WEBHOOKS_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    WORKER_TENANT_FAIRNESS_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    TRANSCRIPTION_PROVIDER: z.enum(["development"]).default("development"),
    EVALUATION_PROVIDER: z.enum(["development", "deepseek"]).default("development"),
    DEEPSEEK_API_URL: z.string().url().default("https://api.deepseek.com/chat/completions"),
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    DEEPSEEK_SECRET_REF: secretReferenceSchema.optional(),
    DEEPSEEK_MODEL: z.string().min(1).default("deepseek-chat"),
    EVALUATION_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    APTLY_MONITORING_ENABLED: z.enum(["true", "false"]).default("true"),
    WEBHOOK_SIGNING_SECRET_REF: secretReferenceSchema.optional(),
    SCIM_TOKEN_SECRET_REF: secretReferenceSchema.optional(),
    SSO_GOOGLE_CLIENT_SECRET_REF: secretReferenceSchema.optional(),
    SSO_MICROSOFT_CLIENT_SECRET_REF: secretReferenceSchema.optional(),
    ATS_SECRET_REF: secretReferenceSchema.optional(),
    DATA_REGION_DEFAULT: z.enum(["US", "EU", "APAC"]).default("US"),
    BACKUP_STORAGE_SECRET_REF: secretReferenceSchema.optional(),
    OBSERVABILITY_EXPORTER_ENDPOINT: z.string().url().optional(),
    RELEASE_COMMIT_SHA: z.string().min(7).max(64).optional(),
    RELEASE_IMAGE_VERSION: z.string().min(1).max(128).optional(),
  })
  .superRefine((value, context) => {
    const isDeployedEnvironment = value.APP_ENV === "staging" || value.APP_ENV === "production";
    if (!isDeployedEnvironment) {
      return;
    }

    requireHttpsUrl(context, "APP_URL", value.APP_URL);
    requireHttpsUrl(context, "CANDIDATE_APP_URL", value.CANDIDATE_APP_URL);
    requireHttpsUrl(context, "INTERNAL_APP_URL", value.INTERNAL_APP_URL);
    requireSecretRef(context, "SESSION_SECRET_REF", value.SESSION_SECRET_REF);
    requireSecretRef(context, "CSRF_SECRET_REF", value.CSRF_SECRET_REF);
    requireSecretRef(context, "TOKEN_PEPPER_SECRET_REF", value.TOKEN_PEPPER_SECRET_REF);
    requireSecretRef(context, "ENCRYPTION_KEY_SECRET_REF", value.ENCRYPTION_KEY_SECRET_REF);
    requireSecretRef(context, "SMTP_SECRET_REF", value.SMTP_SECRET_REF);
    requireSecretRef(context, "OBJECT_STORAGE_SECRET_REF", value.OBJECT_STORAGE_SECRET_REF);
    requireSecretRef(context, "BACKUP_STORAGE_SECRET_REF", value.BACKUP_STORAGE_SECRET_REF);

    if (value.APP_ENV === "production") {
      requireTlsDatabaseUrl(context, value.DATABASE_URL);
      requireTlsRedisUrl(context, value.REDIS_URL);
    }

    if (value.EMAIL_DELIVERY_MODE === "smtp") {
      requireProductionEmail(context, value);
    }
    if (value.EVALUATION_PROVIDER === "deepseek" && value.DEEPSEEK_API_KEY === undefined) {
      requireSecretRef(context, "DEEPSEEK_SECRET_REF", value.DEEPSEEK_SECRET_REF);
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}

export const env = loadEnvironment();

function requireHttpsUrl(
  context: z.RefinementCtx,
  field: keyof Environment,
  value: string | undefined,
): void {
  if (!value?.startsWith("https://")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${field} must be HTTPS in production.`,
    });
  }
}

function requireSecretRef(
  context: z.RefinementCtx,
  field: keyof Environment,
  value: string | undefined,
): void {
  if (!value?.startsWith("secret://")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${field} must use a managed secret reference in production.`,
    });
  }
}

function requireTlsDatabaseUrl(context: z.RefinementCtx, databaseUrl: string): void {
  if (!/sslmode=require|sslmode=verify-full/u.test(databaseUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL must enforce TLS in production.",
    });
  }
}

function requireTlsRedisUrl(context: z.RefinementCtx, redisUrl: string): void {
  if (!redisUrl.startsWith("rediss://")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["REDIS_URL"],
      message: "REDIS_URL must use rediss:// in production.",
    });
  }
}

function requireProductionEmail(context: z.RefinementCtx, value: Environment): void {
  if (value.SMTP_HOST === undefined || value.SMTP_PORT === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SMTP_HOST"],
      message: "SMTP host and port are required when production email delivery is enabled.",
    });
  }
  if (value.SMTP_FROM_EMAIL === undefined || value.SMTP_REPLY_TO_EMAIL === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SMTP_FROM_EMAIL"],
      message: "Production email requires verified from and reply-to addresses.",
    });
  }
}
