import { getPersonalizedInterviewDiagnostic } from "@/modules/personalized-interviews/service";

const applicationId = process.argv.at(2)?.trim() ?? "";

if (applicationId.length === 0) {
  console.error("Usage: npm.cmd run local:personalized-interview-diagnostic -- <applicationId>");
  process.exit(1);
}

const diagnostic = await getPersonalizedInterviewDiagnostic(applicationId);

console.log("Personalized interview diagnostic");
console.log(`Application ID: ${diagnostic.applicationId}`);
console.log(`Job ID: ${diagnostic.jobId}`);
console.log(`Candidate: ${diagnostic.candidate}`);
console.log(`JD intelligence exists: ${diagnostic.jdIntelligenceExists ? "yes" : "no"}`);
console.log(`CV screening exists: ${diagnostic.cvScreeningExists ? "yes" : "no"}`);
console.log(`Availability status: ${diagnostic.availabilityStatus}`);
console.log(`Personalized interview plan status: ${diagnostic.personalizedInterviewPlanStatus}`);
console.log(`Question count: ${String(diagnostic.questionCount)}`);
console.log(`Model: ${diagnostic.model}`);
console.log(`Input length: ${String(diagnostic.inputLength)}`);
console.log(`Safe OpenAI error: ${diagnostic.safeOpenAIError ?? "none"}`);
