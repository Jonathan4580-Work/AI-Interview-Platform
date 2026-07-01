import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCandidateAction } from "@/server/hr-workspace/actions";
import { requireHrWorkspaceContext } from "@/server/hr-workspace/context";
import { getCandidateDetail } from "@/server/hr-workspace/queries";

import { Field, TextField } from "../../../_components/hr-ui";

export default async function EditCandidatePage({
  params,
}: {
  readonly params: Promise<{ readonly candidateId: string }>;
}) {
  const context = await requireHrWorkspaceContext("candidates:manage");
  const { candidateId } = await params;
  const candidate = await getCandidateDetail(context, candidateId);
  if (candidate === null) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Candidates" title="Edit candidate" description={candidate.fullName} />
      <form action={updateCandidateAction}>
        <input type="hidden" name="candidateId" value={candidate.id} />
        <Card>
          <CardHeader>
            <CardTitle>Candidate details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Full name">
              <TextField name="fullName" required defaultValue={candidate.fullName} />
            </Field>
            <Field label="Email">
              <TextField
                name="email"
                type="email"
                required
                defaultValue={candidate.primaryEmail ?? ""}
              />
            </Field>
            <Field label="Phone">
              <TextField name="phone" type="tel" defaultValue={candidate.phone ?? ""} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
