export const dataClasses = [
  "public",
  "internal",
  "confidential",
  "restricted",
  "regulated_sensitive",
] as const;

export type DataClass = (typeof dataClasses)[number];

export interface DataClassificationPolicy {
  readonly dataClass: DataClass;
  readonly requiresAccessAudit: boolean;
  readonly redactFromLogs: boolean;
  readonly requiresRetentionPolicy: boolean;
}

export const dataClassificationPolicies: Record<DataClass, DataClassificationPolicy> = {
  public: {
    dataClass: "public",
    requiresAccessAudit: false,
    redactFromLogs: false,
    requiresRetentionPolicy: false,
  },
  internal: {
    dataClass: "internal",
    requiresAccessAudit: false,
    redactFromLogs: false,
    requiresRetentionPolicy: true,
  },
  confidential: {
    dataClass: "confidential",
    requiresAccessAudit: true,
    redactFromLogs: true,
    requiresRetentionPolicy: true,
  },
  restricted: {
    dataClass: "restricted",
    requiresAccessAudit: true,
    redactFromLogs: true,
    requiresRetentionPolicy: true,
  },
  regulated_sensitive: {
    dataClass: "regulated_sensitive",
    requiresAccessAudit: true,
    redactFromLogs: true,
    requiresRetentionPolicy: true,
  },
};

export const tableDataClassification = {
  companies: "internal",
  company_settings: "internal",
  platform_users: "confidential",
  users: "confidential",
  roles: "internal",
  permissions: "internal",
  support_access_sessions: "restricted",
  legal_holds: "regulated_sensitive",
  privacy_requests: "regulated_sensitive",
  export_requests: "restricted",
  audit_events: "restricted",
  entitlements: "internal",
  usage_counters: "internal",
  subscriptions: "confidential",
  idempotency_keys: "internal",
} as const satisfies Record<string, DataClass>;

export function getDataClassificationPolicy(dataClass: DataClass): DataClassificationPolicy {
  return dataClassificationPolicies[dataClass];
}
