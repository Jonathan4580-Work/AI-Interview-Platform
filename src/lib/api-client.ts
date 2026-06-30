export interface ApiClientMeta {
  requestId: string;
  correlationId: string;
}

export interface ApiClientSuccess<TData> {
  ok: true;
  data: TData;
  meta: ApiClientMeta;
}

export interface ApiClientFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
  meta?: ApiClientMeta;
}

export type ApiClientResponse<TData> = ApiClientSuccess<TData> | ApiClientFailure;

export async function postJson<TData>(
  path: string,
  body: unknown,
  init: RequestInit = {},
): Promise<ApiClientResponse<TData>> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  const response = await fetch(path, {
    ...init,
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as ApiClientResponse<TData>;
  return payload;
}
