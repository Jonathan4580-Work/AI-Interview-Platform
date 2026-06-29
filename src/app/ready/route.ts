import { NextResponse } from "next/server";

import { prisma } from "@/infra/database";
import { redis } from "@/infra/redis";
import { createHealthSnapshot } from "@/modules/observability";

import type { DependencyHealth } from "@/modules/observability";

export async function GET(): Promise<NextResponse> {
  const dependencies = await Promise.all([checkDatabase(), checkRedis()]);
  const snapshot = createHealthSnapshot(dependencies);
  const status = snapshot.state === "ok" ? 200 : 503;

  return NextResponse.json(snapshot, { status });
}

async function checkDatabase(): Promise<DependencyHealth> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "database",
      state: "ok",
    };
  } catch {
    return {
      name: "database",
      state: "degraded",
    };
  }
}

async function checkRedis(): Promise<DependencyHealth> {
  try {
    await redis.ping();

    return {
      name: "redis",
      state: "ok",
    };
  } catch {
    return {
      name: "redis",
      state: "degraded",
    };
  }
}
