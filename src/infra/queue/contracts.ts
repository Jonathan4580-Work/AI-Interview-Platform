import type { QueueName } from "./queue-names";

export interface SafeQueueContext {
  readonly companyId: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface WorkflowQueuePayload extends SafeQueueContext {
  readonly workflowId: string;
  readonly stepId: string;
  readonly stepKey: string;
}

export interface MediaQueuePayload extends SafeQueueContext {
  readonly mediaObjectId: string;
  readonly uploadSessionId?: string;
  readonly operation: "verify_upload" | "delete_object" | "cleanup_expired_upload";
}

export interface ProviderBoundQueuePayload extends SafeQueueContext {
  readonly provider: string;
  readonly operation: string;
  readonly resourceType: string;
  readonly resourceId: string;
}

export interface QueueContract<TPayload extends SafeQueueContext> {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly payload: TPayload;
  readonly jobId: string;
}

const sensitiveKeys = [
  "token",
  "secret",
  "password",
  "credential",
  "signedUrl",
  "url",
  "transcript",
  "prompt",
  "mediaBytes",
] as const;

export function redactQueuePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactQueuePayload(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveQueueKey(key) ? "[redacted]" : redactQueuePayload(item),
    ]),
  );
}

export function assertSafeQueuePayload(payload: SafeQueueContext): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbiddenMarkers = ["http://", "https://", "bearer ", "password", "secret", "token"];
  if (forbiddenMarkers.some((marker) => serialized.includes(marker))) {
    throw new Error("Queue payload contains data that must be rehydrated by workers.");
  }
}

function isSensitiveQueueKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return sensitiveKeys.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
}
