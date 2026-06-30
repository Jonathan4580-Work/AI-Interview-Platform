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
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}

export const env = loadEnvironment();
