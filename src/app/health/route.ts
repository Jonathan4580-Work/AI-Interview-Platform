import { NextResponse } from "next/server";

import { createHealthSnapshot } from "@/modules/observability";

export function GET(): NextResponse {
  return NextResponse.json(
    createHealthSnapshot([
      {
        name: "web",
        state: "ok",
      },
    ]),
  );
}
