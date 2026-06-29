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
  SMTP_SECRET_REF: secretReferenceSchema,
  OBJECT_STORAGE_SECRET_REF: secretReferenceSchema,
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}

export const env = loadEnvironment();
