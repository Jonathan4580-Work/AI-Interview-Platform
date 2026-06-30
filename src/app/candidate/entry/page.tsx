import { Suspense } from "react";

import { CandidateEntryClient } from "./token-exchange";

export default function CandidateEntryPage() {
  return (
    <Suspense>
      <CandidateEntryClient />
    </Suspense>
  );
}
