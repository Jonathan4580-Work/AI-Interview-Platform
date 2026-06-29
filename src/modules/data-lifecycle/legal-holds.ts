import type { TenantContext, TenantId } from "@/modules/tenant";
import type { Brand } from "@/shared";

export type LegalHoldId = Brand<string, "LegalHoldId">;
export type CompanyUserId = Brand<string, "CompanyUserId">;

export const legalHoldStatuses = ["active", "released"] as const;

export type LegalHoldStatus = (typeof legalHoldStatuses)[number];

export interface LegalHold {
  readonly id: LegalHoldId;
  readonly companyId: TenantId;
  readonly name: string;
  readonly description: string | null;
  readonly status: LegalHoldStatus;
  readonly createdByUserId: CompanyUserId;
  readonly releasedByUserId: CompanyUserId | null;
  readonly createdAt: Date;
  readonly releasedAt: Date | null;
}

export interface CreateLegalHoldInput {
  readonly tenant: TenantContext;
  readonly name: string;
  readonly description?: string | null;
  readonly createdByUserId: CompanyUserId;
}

export interface ReleaseLegalHoldInput {
  readonly tenant: TenantContext;
  readonly legalHoldId: LegalHoldId;
  readonly releasedByUserId: CompanyUserId;
  readonly releasedAt?: Date;
}

export interface LegalHoldStore {
  create(input: {
    readonly companyId: TenantId;
    readonly name: string;
    readonly description: string | null;
    readonly createdByUserId: CompanyUserId;
  }): Promise<LegalHold>;

  release(input: {
    readonly tenant: TenantContext;
    readonly legalHoldId: LegalHoldId;
    readonly releasedByUserId: CompanyUserId;
    readonly releasedAt: Date;
  }): Promise<LegalHold>;

  hasActiveHold(tenant: TenantContext): Promise<boolean>;
}

export class LegalHoldError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LegalHoldError";
  }
}

export class LegalHoldService {
  public constructor(
    private readonly store: LegalHoldStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public create(input: CreateLegalHoldInput): Promise<LegalHold> {
    const name = input.name.trim();
    if (name.length < 4) {
      throw new LegalHoldError("Legal hold name must be specific.");
    }

    const trimmedDescription = input.description?.trim();
    const description =
      trimmedDescription === undefined || trimmedDescription.length === 0
        ? null
        : trimmedDescription;

    return this.store.create({
      companyId: input.tenant.companyId,
      name,
      description,
      createdByUserId: input.createdByUserId,
    });
  }

  public release(input: ReleaseLegalHoldInput): Promise<LegalHold> {
    return this.store.release({
      tenant: input.tenant,
      legalHoldId: input.legalHoldId,
      releasedByUserId: input.releasedByUserId,
      releasedAt: input.releasedAt ?? this.now(),
    });
  }

  public async assertDeletionAllowed(tenant: TenantContext): Promise<void> {
    if (await this.store.hasActiveHold(tenant)) {
      throw new LegalHoldError("Deletion is blocked by an active legal hold.");
    }
  }
}
