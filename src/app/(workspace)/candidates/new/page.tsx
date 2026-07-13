import { PageHeader } from "@/components/layout/page-header";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCandidateAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";

import { Field, TextField } from "../../_components/hr-ui";

export default async function NewCandidatePage() {
  await requireHrWorkspaceContext("candidates:manage");
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Candidates"
        title="Add candidate"
        description="Create a candidate profile with the minimum information needed for an interview invitation."
      />
      <form action={createCandidateAction}>
        <Card>
          <CardHeader>
            <CardTitle>Candidate details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Full name">
              <TextField name="fullName" required minLength={2} maxLength={160} />
            </Field>
            <Field label="Email">
              <TextField name="email" type="email" required maxLength={320} />
            </Field>
            <Field label="Phone">
              <TextField name="phone" type="tel" maxLength={40} />
            </Field>
            <div className="flex justify-end">
              <PendingSubmitButton pendingLabel="Adding candidate...">
                Add candidate
              </PendingSubmitButton>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
