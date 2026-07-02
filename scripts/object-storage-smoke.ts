import { createHash, randomUUID } from "node:crypto";
import { stdout as output } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/config";
import { S3CompatibleObjectStorageProvider } from "../src/modules/media";

const MIME_TYPE = "text/plain";
const PAYLOAD = "aptly synthetic object-storage smoke\n";

interface ObjectStorageSmokeResult {
  readonly provider: string;
  readonly bucket: string;
  readonly region: string | null;
  readonly storageKey: string;
  readonly uploadedBytes: number;
  readonly verifiedBytes: string;
  readonly downloadedBytes: number;
  readonly deleted: boolean;
}

export async function runObjectStorageSmoke(): Promise<ObjectStorageSmokeResult> {
  requireConfiguredStorage();

  const provider = new S3CompatibleObjectStorageProvider();
  const storageKey = `smoke/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`;
  const body = new TextEncoder().encode(PAYLOAD);

  const upload = await provider.createSignedUploadUrl({
    storageKey,
    mimeType: MIME_TYPE,
    expiresInSeconds: 300,
  });
  const uploadResponse = await fetch(upload.url, {
    method: "PUT",
    headers: upload.headers,
    body,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Synthetic upload failed with status ${String(uploadResponse.status)}.`);
  }

  const verification = await provider.verifyObject(storageKey);
  if (!verification.exists) {
    throw new Error("Synthetic object was not found after upload.");
  }
  if (verification.sizeBytes !== BigInt(body.byteLength)) {
    throw new Error("Synthetic object size verification failed.");
  }
  if (verification.mimeType !== null && verification.mimeType !== MIME_TYPE) {
    throw new Error(`Synthetic object MIME verification failed: ${verification.mimeType}.`);
  }

  const download = await provider.createSignedDownloadUrl({
    storageKey,
    expiresInSeconds: 300,
    contentDisposition: 'attachment; filename="aptly-smoke.txt"',
  });
  const downloadResponse = await fetch(download.url);
  if (!downloadResponse.ok) {
    throw new Error(`Synthetic download failed with status ${String(downloadResponse.status)}.`);
  }
  const downloaded = new Uint8Array(await downloadResponse.arrayBuffer());
  if (createHash("sha256").update(downloaded).digest("hex") !== sha256(body)) {
    throw new Error("Synthetic downloaded object did not match uploaded bytes.");
  }

  await provider.deleteObject(storageKey);
  const afterDelete = await provider.verifyObject(storageKey);
  if (afterDelete.exists) {
    throw new Error("Synthetic object still exists after delete.");
  }

  return {
    provider: provider.providerKey,
    bucket: provider.bucket,
    region: provider.region,
    storageKey,
    uploadedBytes: body.byteLength,
    verifiedBytes: verification.sizeBytes.toString(),
    downloadedBytes: downloaded.byteLength,
    deleted: true,
  };
}

function requireConfiguredStorage(): void {
  const missing = [
    ["OBJECT_STORAGE_ENDPOINT", env.OBJECT_STORAGE_ENDPOINT],
    ["OBJECT_STORAGE_BUCKET", env.OBJECT_STORAGE_BUCKET],
    ["OBJECT_STORAGE_ACCESS_KEY_ID", env.OBJECT_STORAGE_ACCESS_KEY_ID],
    ["OBJECT_STORAGE_SECRET_ACCESS_KEY", env.OBJECT_STORAGE_SECRET_ACCESS_KEY],
    ["OBJECT_STORAGE_SECRET_REF", env.OBJECT_STORAGE_SECRET_REF],
  ]
    .filter(([, value]) => value === undefined || value.length === 0)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Object storage smoke is missing: ${missing.join(", ")}.`);
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function render(result: ObjectStorageSmokeResult): string {
  return [
    "Object-storage smoke passed.",
    `Provider: ${result.provider}`,
    `Bucket: ${result.bucket}`,
    `Region: ${result.region ?? "default"}`,
    `Storage key: ${result.storageKey}`,
    `Uploaded bytes: ${String(result.uploadedBytes)}`,
    `Verified bytes: ${result.verifiedBytes}`,
    `Downloaded bytes: ${String(result.downloadedBytes)}`,
    `Deleted: ${String(result.deleted)}`,
    "",
  ].join("\n");
}

const executedPath = resolve(process.argv[1] ?? "");
if (fileURLToPath(import.meta.url) === executedPath) {
  runObjectStorageSmoke()
    .then((result) => {
      output.write(render(result));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown object-storage failure.";
      console.error(`Object-storage smoke failed: ${message}`);
      process.exitCode = 1;
    });
}
