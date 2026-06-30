import { postJson } from "@/lib/api-client";

export type LoginMode = "company" | "platform";

export interface LoginInput {
  mode: LoginMode;
  companyId?: string;
  email: string;
  password: string;
}

export interface AuthenticatedSubject {
  type: string;
  email: string;
  name: string;
  status: string;
  companyId?: string;
  userId?: string;
  platformUserId?: string;
}

export interface LoginResult {
  subject: AuthenticatedSubject;
  sessionId: string;
  expiresAt: string;
}

export async function login(input: LoginInput) {
  const body =
    input.mode === "company"
      ? {
          type: "company",
          companyId: input.companyId,
          email: input.email,
          password: input.password,
        }
      : {
          type: "platform",
          email: input.email,
          password: input.password,
        };

  return postJson<LoginResult>("/api/internal/v1/auth/login", body);
}
