export const queueNames = [
  "email",
  "orchestration",
  "media",
  "provider-bound",
  "interview-maintenance",
  "media-finalization",
  "transcription",
  "evaluation",
  "reporting",
  "exports",
  "retention",
  "integrations",
  "webhooks",
  "notifications",
] as const;

export type QueueName = (typeof queueNames)[number];
