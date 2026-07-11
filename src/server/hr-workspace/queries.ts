import { prisma } from "@/infra/database";

import type { HrWorkspaceContext } from "./context";

const ACTIVE_INTERVIEW_STATUSES = [
  "NOT_STARTED",
  "READY_CHECK",
  "READY",
  "IN_PROGRESS",
  "INTERRUPTED",
  "UPLOAD_RECOVERY",
] as const;

export async function getDashboardData(context: HrWorkspaceContext) {
  const companyId = context.tenant.companyId;
  const [
    activeJobs,
    totalCandidates,
    invitationsSent,
    interviewsAwaitingCompletion,
    interviewsCompleted,
    resultsReady,
    recentActivity,
  ] = await Promise.all([
    prisma.job.count({ where: { companyId, status: "OPEN", deletedAt: null } }),
    prisma.candidate.count({ where: { companyId, status: "ACTIVE", deletedAt: null } }),
    prisma.candidateInvitation.count({
      where: { companyId, status: { in: ["SENT", "OPENED", "ACCEPTED"] } },
    }),
    prisma.interviewSession.count({
      where: { companyId, status: { in: [...ACTIVE_INTERVIEW_STATUSES] } },
    }),
    prisma.interviewSession.count({
      where: { companyId, status: { in: ["COMPLETED", "PROCESSING"] } },
    }),
    prisma.hrReport.count({
      where: { companyId, status: "READY", activeVersionId: { not: null } },
    }),
    prisma.auditEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    activeJobs,
    totalCandidates,
    invitationsSent,
    interviewsAwaitingCompletion,
    interviewsCompleted,
    resultsReady,
    recentActivity,
  };
}

export async function listJobs(context: HrWorkspaceContext) {
  return prisma.job.findMany({
    where: { companyId: context.tenant.companyId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      applications: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
      plans: {
        where: { deletedAt: null },
        select: { id: true, name: true, status: true, activeVersionId: true },
      },
    },
  });
}

export async function getJobDetail(context: HrWorkspaceContext, jobId: string) {
  return prisma.job.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    include: {
      company: { select: { name: true, slug: true } },
      pipeline: {
        include: { stages: { where: { status: "ACTIVE" }, orderBy: { position: "asc" } } },
      },
      plans: {
        where: { deletedAt: null },
        include: {
          versions: { orderBy: { versionNumber: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
      },
      descriptionAssets: { orderBy: { createdAt: "desc" }, take: 1 },
      intelligenceProfile: true,
      interviewQuestions: { orderBy: { sequence: "asc" } },
      applications: {
        where: { deletedAt: null },
        include: {
          candidate: true,
          currentStage: true,
          invitations: { orderBy: { createdAt: "desc" }, take: 3 },
          interviewSessions: {
            orderBy: { updatedAt: "desc" },
            take: 3,
            include: { hrReports: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export async function getJobReviewDetail(context: HrWorkspaceContext, jobId: string) {
  const job = await prisma.job.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: jobId } },
    include: {
      descriptionAssets: { orderBy: { createdAt: "desc" } },
      intelligenceProfile: true,
      interviewQuestions: { orderBy: { sequence: "asc" } },
    },
  });
  if (job === null) {
    return null;
  }
  const workflows = await prisma.processingWorkflow.findMany({
    where: { companyId: context.tenant.companyId, subjectType: "job", subjectId: jobId },
    include: { steps: { orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  return { ...job, workflows };
}

export async function listCandidates(context: HrWorkspaceContext, query: string | null) {
  const search = query?.trim();
  return prisma.candidate.findMany({
    where: {
      companyId: context.tenant.companyId,
      deletedAt: null,
      ...(search === undefined || search.length === 0
        ? {}
        : {
            OR: [
              { fullName: { contains: search } },
              { primaryEmail: { contains: search.toLowerCase() } },
            ],
          }),
    },
    include: {
      applications: {
        where: { deletedAt: null },
        include: { job: true },
        orderBy: { updatedAt: "desc" },
      },
      invitations: { orderBy: { createdAt: "desc" }, take: 3 },
      interviewSessions: { orderBy: { updatedAt: "desc" }, take: 3, include: { hrReports: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getCandidateDetail(context: HrWorkspaceContext, candidateId: string) {
  return prisma.candidate.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: candidateId } },
    include: {
      applications: {
        where: { deletedAt: null },
        include: {
          job: {
            include: { plans: { where: { status: "ACTIVE", activeVersionId: { not: null } } } },
          },
          currentStage: true,
          invitations: {
            orderBy: { createdAt: "desc" },
            include: {
              consentRecords: { select: { id: true }, take: 1 },
              identityVerifications: { select: { id: true }, take: 1 },
              readinessChecks: { select: { id: true }, take: 1 },
            },
          },
          interviewSessions: {
            orderBy: { updatedAt: "desc" },
            include: {
              hrReports: true,
              transcripts: { select: { id: true, status: true, activeVersionId: true }, take: 1 },
              evaluationVersions: {
                select: { id: true, status: true },
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      invitations: { orderBy: { createdAt: "desc" } },
      interviewSessions: {
        orderBy: { updatedAt: "desc" },
        include: {
          hrReports: { include: { activeVersion: true } },
          transcripts: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            include: {
              activeVersion: {
                include: { segments: { orderBy: { sequence: "asc" }, take: 3 } },
              },
            },
          },
          evaluationVersions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              scores: { include: { evidenceCitations: true }, orderBy: { competencyKey: "asc" } },
              observations: true,
              limitations: true,
            },
          },
        },
      },
    },
  });
}

export async function listInterviews(context: HrWorkspaceContext) {
  return prisma.interviewSession.findMany({
    where: { companyId: context.tenant.companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      candidate: true,
      invitation: true,
      application: { include: { job: true, currentStage: true } },
      hrReports: true,
      transcripts: true,
      evaluationVersions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
    take: 100,
  });
}

export async function listRecentCandidateReports(context: HrWorkspaceContext) {
  return prisma.hrReport.findMany({
    where: {
      companyId: context.tenant.companyId,
      status: "READY",
      activeVersionId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: {
      activeVersion: true,
      interviewSession: {
        include: {
          candidate: true,
          application: { include: { job: true } },
          evaluationVersions: {
            select: { id: true, status: true, overallConfidence: true },
            where: { status: "READY" },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function getInterviewDetail(context: HrWorkspaceContext, interviewSessionId: string) {
  const interview = await prisma.interviewSession.findUnique({
    where: { companyId_id: { companyId: context.tenant.companyId, id: interviewSessionId } },
    include: {
      candidate: true,
      invitation: true,
      application: { include: { job: true, currentStage: true } },
      interviewQuestionStates: { orderBy: { sequence: "asc" } },
      interviewTurns: { orderBy: [{ sequence: "asc" }, { attemptNumber: "asc" }] },
      interviewTurnMedia: { include: { mediaObject: true }, orderBy: { chunkSequence: "asc" } },
      recoveryCheckpoints: { orderBy: { createdAt: "desc" } },
      stateHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      readinessChecks: { orderBy: { checkedAt: "desc" } },
      monitoringEvents: { orderBy: { occurredAt: "desc" }, take: 20 },
      transcripts: {
        take: 1,
        orderBy: { updatedAt: "desc" },
        include: {
          activeVersion: {
            include: {
              segments: { orderBy: { sequence: "asc" }, take: 50 },
            },
          },
        },
      },
      evaluationVersions: {
        where: { status: "READY" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          scores: { include: { evidenceCitations: true }, orderBy: { competencyKey: "asc" } },
          observations: true,
          limitations: true,
          overrides: { orderBy: { createdAt: "desc" } },
        },
      },
      hrReports: {
        take: 1,
        orderBy: { updatedAt: "desc" },
        include: { activeVersion: true },
      },
      humanDecisionHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (interview === null) {
    return null;
  }
  const processingWorkflow =
    interview.processingWorkflowId === null
      ? null
      : await prisma.processingWorkflow.findUnique({
          where: {
            companyId_id: {
              companyId: context.tenant.companyId,
              id: interview.processingWorkflowId,
            },
          },
          include: { steps: { orderBy: { sequence: "asc" } } },
        });
  return { ...interview, processingWorkflow };
}

export async function listApplicationChoices(context: HrWorkspaceContext) {
  const [candidates, jobs] = await Promise.all([
    prisma.candidate.findMany({
      where: { companyId: context.tenant.companyId, status: "ACTIVE", deletedAt: null },
      orderBy: { fullName: "asc" },
    }),
    prisma.job.findMany({
      where: {
        companyId: context.tenant.companyId,
        status: { in: ["OPEN", "DRAFT", "PAUSED"] },
        deletedAt: null,
      },
      include: {
        pipeline: {
          include: { stages: { where: { status: "ACTIVE" }, orderBy: { position: "asc" } } },
        },
        plans: { where: { status: "ACTIVE", activeVersionId: { not: null } } },
      },
      orderBy: { title: "asc" },
    }),
  ]);
  return { candidates, jobs };
}
