const FORMULA_PREFIXES = ["=", "+", "-", "@"] as const;

export function protectCsvValue(value: string | number | boolean | null): string {
  const normalized = value === null ? "" : String(value);
  if (normalized.length === 0) {
    return normalized;
  }

  const trimmedStart = normalized.trimStart();
  const first = trimmedStart.at(0);
  if (
    first !== undefined &&
    FORMULA_PREFIXES.includes(first as (typeof FORMULA_PREFIXES)[number])
  ) {
    return `'${normalized}`;
  }

  return normalized;
}

export function encodeCsvRow(values: readonly (string | number | boolean | null)[]): string {
  return values.map((value) => encodeCsvCell(protectCsvValue(value))).join(",");
}

export function encodeCsv(
  rows: readonly (readonly (string | number | boolean | null)[])[],
): string {
  return `${rows.map((row) => encodeCsvRow(row)).join("\r\n")}\r\n`;
}

function encodeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}
