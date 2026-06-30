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
  "retention",
  "notifications",
] as const;

export type QueueName = (typeof queueNames)[number];
