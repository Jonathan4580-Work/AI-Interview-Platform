import { NextResponse } from "next/server";

import { env } from "@/config";
import { LocalFilesystemStorageProvider, isValidLocalStorageSignature } from "@/modules/media";

export async function PUT(request: Request): Promise<NextResponse> {
  if (env.STORAGE_PROVIDER !== "local") {
    return NextResponse.json({ ok: false, error: "Local storage is disabled." }, { status: 404 });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expires = url.searchParams.get("expires");
  const signature = url.searchParams.get("sig");
  if (
    key === null ||
    expires === null ||
    !isValidLocalStorageSignature({ action: "upload", storageKey: key, expires, signature })
  ) {
    return NextResponse.json(
      { ok: false, error: "Upload URL is invalid or expired." },
      { status: 403 },
    );
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  await new LocalFilesystemStorageProvider().writeObject(key, bytes);
  return NextResponse.json({ ok: true });
}
