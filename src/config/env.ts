import { z } from "zod";

const secretReferenceSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9/_:.-]+$/, "Secret references must use stable secret-store identifiers.");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("Aptly"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
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
  WORKER_ORCHESTRATION_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  WORKER_MEDIA_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(3),
  WORKER_PROVIDER_BOUND_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
  WORKER_NOTIFICATIONS_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  TRANSCRIPTION_PROVIDER: z.enum(["development"]).default("development"),
  EVALUATION_PROVIDER: z.enum(["development", "deepseek"]).default("development"),
  DEEPSEEK_API_URL: z.string().url().default("https://api.deepseek.com/chat/completions"),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-chat"),
  EVALUATION_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}

export const env = loadEnvironment();
