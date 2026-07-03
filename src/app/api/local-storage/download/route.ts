import { NextResponse } from "next/server";

import { env } from "@/config";
import { LocalFilesystemStorageProvider, isValidLocalStorageSignature } from "@/modules/media";

export async function GET(request: Request): Promise<NextResponse> {
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
    !isValidLocalStorageSignature({ action: "download", storageKey: key, expires, signature })
  ) {
    return NextResponse.json(
      { ok: false, error: "Download URL is invalid or expired." },
      { status: 403 },
    );
  }
  const bytes = await new LocalFilesystemStorageProvider().readObject(key);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}
