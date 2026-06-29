export type HealthState = "ok" | "degraded";

export interface DependencyHealth {
  readonly name: string;
  readonly state: HealthState;
}

export interface HealthSnapshot {
  readonly state: HealthState;
  readonly dependencies: readonly DependencyHealth[];
}

export function createHealthSnapshot(dependencies: readonly DependencyHealth[]): HealthSnapshot {
  return {
    state: dependencies.every((dependency) => dependency.state === "ok") ? "ok" : "degraded",
    dependencies,
  };
}
