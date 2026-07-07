"use client";

export function readCandidateCsrfToken(): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.includes("aptly_candidate_csrf="));
  if (cookie === undefined) {
    return null;
  }
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

export async function candidatePost(
  path: string,
  body?: unknown,
): Promise<{
  readonly ok: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly status: number;
  readonly code?: string;
}> {
  const csrfToken = readCandidateCsrfToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(csrfToken === null ? {} : { "x-candidate-csrf-token": csrfToken }),
    },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    readonly ok: boolean;
    readonly data?: unknown;
    readonly error?: { readonly code?: string; readonly message?: string };
  };
  return {
    ok: response.ok && payload.ok,
    data: payload.data,
    error: payload.error?.message ?? "The request could not be completed.",
    status: response.status,
    code: payload.error?.code,
  };
}

export async function candidateGet(path: string): Promise<{
  readonly ok: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly status: number;
  readonly code?: string;
}> {
  const response = await fetch(path, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  const payload = (await response.json()) as {
    readonly ok: boolean;
    readonly data?: unknown;
    readonly error?: { readonly code?: string; readonly message?: string };
  };
  return {
    ok: response.ok && payload.ok,
    data: payload.data,
    error: payload.error?.message ?? "The request could not be completed.",
    status: response.status,
    code: payload.error?.code,
  };
}
