import { describe, expect, it } from "vitest";

import {
  createInsufficientTextAnalysis,
  hashJobDescriptionText,
  parseJobDescriptionAnalysis,
} from "@/modules/jobs/jd-analysis";
import { parseJobDescriptionAutofill } from "@/modules/jobs/jd-local-autofill";
import {
  extractJobDescriptionText,
  extractPdfText,
} from "@/server/hr-workspace/jd-text-extraction";

const validAnalysis = {
  title: "Customer Support Specialist",
  department: "Support",
  employmentType: "Full time",
  workplaceType: "Remote",
  location: "Colombo",
  experience: "2+ years",
  responsibilities: ["Resolve customer issues", "Document support interactions"],
  requiredSkills: ["Clear communication", "Ticket management"],
  niceToHaveSkills: ["SaaS support"],
  educationAndCertifications: ["No strict degree requirement"],
  toolsAndTechnologies: ["Zendesk"],
  seniorityExpectations: ["Mid-level support ownership"],
  screeningCriteria: ["Relevant customer support experience"],
  roleCompetencies: [
    { name: "Communication", description: "Explains clearly" },
    { name: "Problem solving", description: "Solves customer issues" },
    { name: "Role relevance", description: "Has support experience" },
  ],
  interviewStructure: ["Opening", "Behavioral questions", "Closing"],
  scoringRubric: ["1 insufficient", "3 meets", "5 strong"],
  redFlags: ["Disrespectful customer language"],
  questions: [
    {
      competencyName: "Communication",
      competencyDescription: "Explains clearly",
      questionText: "Please introduce yourself and describe your support experience.",
      questionType: "introduction",
      difficulty: "introductory",
      expectedAnswerSignals: ["Concise relevant background"],
      scoringRubric: ["Clear and relevant"],
      redFlags: ["No relevant experience"],
      followUps: ["Which customers did you support?"],
    },
    {
      competencyName: "Problem solving",
      competencyDescription: "Solves customer issues",
      questionText: "Tell us about a customer problem you resolved.",
      questionType: "behavioral",
      difficulty: "standard",
      expectedAnswerSignals: ["Specific action and outcome"],
      scoringRubric: ["Evidence of ownership"],
      redFlags: ["No outcome"],
      followUps: ["What changed after your action?"],
    },
    {
      competencyName: "Role relevance",
      competencyDescription: "Has support experience",
      questionText: "How do you prioritize support tickets when everything feels urgent?",
      questionType: "situational",
      difficulty: "standard",
      expectedAnswerSignals: ["Structured prioritization"],
      scoringRubric: ["Uses impact and urgency"],
      redFlags: ["No prioritization method"],
      followUps: ["How would you communicate delays?"],
    },
  ],
};

describe("JD-driven job creation foundation", () => {
  it("parses valid structured JD analysis output", () => {
    const parsed = parseJobDescriptionAnalysis(JSON.stringify(validAnalysis));
    expect(parsed.title).toBe("Customer Support Specialist");
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.roleCompetencies.map((competency) => competency.name)).toContain("Communication");
  });

  it("rejects malformed JD analysis output", () => {
    expect(() => parseJobDescriptionAnalysis(JSON.stringify({ title: "Missing fields" }))).toThrow(
      /failed validation/u,
    );
  });

  it("creates a safe insufficient-text draft instead of placeholder nonsense", () => {
    const draft = createInsufficientTextAnalysis("Support role");
    expect(draft.title).toBe("Support role");
    expect(draft.questions).toHaveLength(3);
    expect(draft.redFlags).toContain("Insufficient job description detail.");
  });

  it("hashes JD text deterministically", () => {
    expect(hashJobDescriptionText("hello")).toBe(hashJobDescriptionText("hello"));
    expect(hashJobDescriptionText("hello")).not.toBe(hashJobDescriptionText("hello "));
  });

  it("extracts pasted JD text before reading a file", async () => {
    const result = await extractJobDescriptionText({
      pastedText: " Senior support role with customer communication and troubleshooting. ".repeat(
        2,
      ),
      file: null,
    });
    expect(result.sourceType).toBe("PASTED_TEXT");
    expect(result.text).toContain("Senior support role");
  });

  it("rejects unsupported uploaded files", async () => {
    const file = new File(["hello"], "job.txt", { type: "text/plain" });
    await expect(extractJobDescriptionText({ pastedText: "", file })).rejects.toThrow(
      /PDF or DOCX/u,
    );
  });

  it("extracts simple text operators from readable PDF content", () => {
    const buffer = Buffer.from("%PDF-1.4\nBT (Customer support role) Tj ET", "latin1");
    expect(extractPdfText(buffer)).toBe("Customer support role");
  });

  it("autofills obvious fields from pasted JD text without provider calls", () => {
    const draft = parseJobDescriptionAutofill(`Software Engineer
Department: Engineering
Location: Colombo Hybrid
Full-time role
3+ years experience

Responsibilities
- Build product features
- Review code

Requirements
- TypeScript
- SQL

Nice to have
- Recruiting software experience`);

    expect(draft.title).toBe("Software Engineer");
    expect(draft.department).toBe("Engineering");
    expect(draft.location).toBe("Colombo Hybrid");
    expect(draft.employmentType).toBe("Full time");
    expect(draft.experienceLevel).toBe("3+ years experience");
    expect(draft.responsibilities).toContain("Build product features");
    expect(draft.requirements).toContain("TypeScript");
    expect(draft.niceToHaveSkills).toContain("Recruiting software experience");
  });
});
