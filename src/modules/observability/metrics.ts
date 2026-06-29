export interface MetricSample {
  readonly name: string;
  readonly value: number;
  readonly tags: Readonly<Record<string, string>>;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, MetricSample>();

  public increment(name: string, tags: Readonly<Record<string, string>> = {}, amount = 1): void {
    const key = this.createKey(name, tags);
    const current = this.counters.get(key);

    this.counters.set(key, {
      name,
      tags,
      value: (current?.value ?? 0) + amount,
    });
  }

  public snapshot(): readonly MetricSample[] {
    return Array.from(this.counters.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  private createKey(name: string, tags: Readonly<Record<string, string>>): string {
    return JSON.stringify([name, Object.entries(tags).sort()]);
  }
}
