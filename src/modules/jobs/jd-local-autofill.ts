export interface JobDescriptionAutofillDraft {
  readonly title: string | null;
  readonly department: string | null;
  readonly location: string | null;
  readonly employmentType: string | null;
  readonly experienceLevel: string | null;
  readonly responsibilities: readonly string[];
  readonly requirements: readonly string[];
  readonly niceToHaveSkills: readonly string[];
}

const SECTION_ALIASES = [
  {
    key: "responsibilities",
    labels: ["responsibilities", "what you will do", "role responsibilities"],
  },
  {
    key: "requirements",
    labels: ["requirements", "required skills", "qualifications", "must have"],
  },
  {
    key: "niceToHaveSkills",
    labels: ["nice to have", "nice-to-have", "preferred", "bonus", "preferred qualifications"],
  },
] as const;

export function parseJobDescriptionAutofill(text: string): JobDescriptionAutofillDraft {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0);
  const sections = collectSections(lines);
  return {
    title: detectTitle(lines),
    department: detectField(lines, ["department", "team"]),
    location: detectField(lines, ["location", "based in"]),
    employmentType: detectEmploymentType(text),
    experienceLevel: detectExperience(text),
    responsibilities: sections.responsibilities,
    requirements: sections.requirements,
    niceToHaveSkills: sections.niceToHaveSkills,
  };
}

function detectTitle(lines: readonly string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const lower = line.toLowerCase();
    if (
      line.length >= 3 &&
      line.length <= 120 &&
      !lower.includes("job description") &&
      !lower.includes("about the role") &&
      !lower.includes("overview") &&
      !line.includes(":")
    ) {
      return line;
    }
  }
  return null;
}

function detectField(lines: readonly string[], labels: readonly string[]): string | null {
  for (const line of lines.slice(0, 30)) {
    const [rawLabel, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();
    if (value.length === 0) continue;
    const label = rawLabel.trim().toLowerCase();
    if (labels.some((candidate) => label === candidate || label.includes(candidate))) {
      return value.slice(0, 160);
    }
  }
  return null;
}

function detectEmploymentType(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bpart[-\s]?time\b/u.test(lower)) return "Part time";
  if (/\bcontract\b/u.test(lower)) return "Contract";
  if (/\bintern(ship)?\b/u.test(lower)) return "Internship";
  if (/\btemporary\b|\btemp\b/u.test(lower)) return "Temporary";
  if (/\bfull[-\s]?time\b/u.test(lower)) return "Full time";
  return null;
}

function detectExperience(text: string): string | null {
  const match = /\b(\d+\+?\s*(?:-|to)?\s*\d*\+?\s*years?(?:\s+of)?\s+experience)\b/iu.exec(text);
  if (match?.[1]) return match[1].slice(0, 160);
  const lower = text.toLowerCase();
  if (lower.includes("entry level") || lower.includes("junior")) return "Entry level";
  if (lower.includes("senior")) return "Senior";
  if (lower.includes("staff") || lower.includes("principal")) return "Staff";
  if (lower.includes("mid level") || lower.includes("mid-level")) return "Mid level";
  return null;
}

function collectSections(lines: readonly string[]) {
  const output: Record<"responsibilities" | "requirements" | "niceToHaveSkills", string[]> = {
    responsibilities: [],
    requirements: [],
    niceToHaveSkills: [],
  };
  let active: keyof typeof output | null = null;

  for (const line of lines) {
    const sectionKey = sectionForLine(line);
    if (sectionKey !== null) {
      active = sectionKey;
      continue;
    }
    if (active === null) continue;
    if (looksLikeSectionHeading(line)) {
      active = null;
      continue;
    }
    const item = line.replace(/^[-*•\d.)\s]+/u, "").trim();
    if (item.length >= 3 && output[active].length < 12) {
      output[active].push(item.slice(0, 500));
    }
  }
  return output;
}

function sectionForLine(
  line: string,
): "responsibilities" | "requirements" | "niceToHaveSkills" | null {
  const normalized = line.toLowerCase().replace(/:$/u, "");
  for (const section of SECTION_ALIASES) {
    if (
      section.labels.some((label) => normalized === label || normalized.startsWith(`${label}:`))
    ) {
      return section.key;
    }
  }
  return null;
}

function looksLikeSectionHeading(line: string): boolean {
  return (
    line.length <= 80 &&
    !line.startsWith("-") &&
    /:?$/u.test(line) &&
    /^[A-Z][\w\s/&+-]+:?$/u.test(line)
  );
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/gu, " ").trim();
}
