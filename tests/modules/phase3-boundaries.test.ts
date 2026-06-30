import { describe, expect, it } from "vitest";

import { permissionKeys } from "@/modules/access-control";
import { CandidatesService } from "@/modules/candidates";
import { InvitationsService } from "@/modules/invitations";
import { JobsService } from "@/modules/jobs";
import { NotificationsService } from "@/modules/notifications";
import { OrganizationService } from "@/modules/organization";
import { SchedulingService } from "@/modules/scheduling";

describe("phase 3 module boundaries", () => {
  it("exposes domain services through module roots", () => {
    expect(OrganizationService).toBeDefined();
    expect(JobsService).toBeDefined();
    expect(CandidatesService).toBeDefined();
    expect(InvitationsService).toBeDefined();
    expect(SchedulingService).toBeDefined();
    expect(NotificationsService).toBeDefined();
  });

  it("keeps phase 3 permissions in the central RBAC catalog", () => {
    expect(permissionKeys).toEqual(
      expect.arrayContaining([
        "departments:manage",
        "teams:manage",
        "locations:manage",
        "jobs:manage",
        "job_templates:manage",
        "pipelines:manage",
        "interview_plans:manage",
        "candidates:manage",
        "applications:manage",
        "candidate_notes:manage",
        "scheduling:manage",
        "notifications:manage",
      ]),
    );
  });
});
