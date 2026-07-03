import { createHash, randomUUID } from "node:crypto";

import { LocalFilesystemStorageProvider } from "@/modules/media";

const payload = new TextEncoder().encode("aptly local storage smoke\n");

async function main(): Promise<void> {
  const provider = new LocalFilesystemStorageProvider();
  const storageKey = `smoke/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`;
  await provider.writeObject(storageKey, payload);

  const verification = await provider.verifyObject(storageKey);
  if (!verification.exists || verification.sizeBytes !== BigInt(payload.byteLength)) {
    throw new Error("Local storage verification failed.");
  }

  const downloaded = await provider.readObject(storageKey);
  if (sha256(downloaded) !== sha256(payload)) {
    throw new Error("Local storage downloaded bytes did not match uploaded bytes.");
  }

  await provider.deleteObject(storageKey);
  const afterDelete = await provider.verifyObject(storageKey);
  if (afterDelete.exists) {
    throw new Error("Local storage object still exists after delete.");
  }

  console.log(
    [
      "Local storage smoke PASSED",
      `Provider: ${provider.providerKey}`,
      `Storage key: ${storageKey}`,
      `Bytes: ${String(payload.byteLength)}`,
      "",
    ].join("\n"),
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local storage smoke failure.";
  console.error(`Local storage smoke FAILED: ${message}`);
  process.exitCode = 1;
});
