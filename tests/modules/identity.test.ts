import { PlatformUserStatus, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  isCompanyUserActive,
  mapCompanyUserStatus,
  mapPlatformUserStatus,
  normalizeEmail,
} from "@/modules/identity";

describe("identity module", () => {
  it("normalizes valid email addresses", () => {
    expect(normalizeEmail(" Recruiter@Example.COM ")).toBe("recruiter@example.com");
  });

  it("rejects malformed email addresses", () => {
    expect(() => {
      normalizeEmail("not-an-email");
    }).toThrow("Invalid email address.");
  });

  it("maps platform and company user statuses", () => {
    expect(mapPlatformUserStatus(PlatformUserStatus.ACTIVE)).toBe("active");
    expect(mapCompanyUserStatus(UserStatus.INVITED)).toBe("invited");
    expect(isCompanyUserActive("active")).toBe(true);
    expect(isCompanyUserActive("disabled")).toBe(false);
  });
});
