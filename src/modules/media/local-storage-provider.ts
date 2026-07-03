import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

import { env } from "@/config";

import type { ObjectStorageProvider, ObjectStorageVerification, SignedUrl } from "./types";

const LOCAL_URL_TTL_SECONDS = 10 * 60;

export class LocalFilesystemStorageProvider implements ObjectStorageProvider {
  public readonly providerKey = "local";
  public readonly bucket = "local";
  public readonly region = "local";
  private readonly root = resolve(env.LOCAL_STORAGE_ROOT);

  public createSignedUploadUrl(input: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly checksumSha256?: string | null;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl> {
    const expiresAt = expiresAtFrom(input.expiresInSeconds);
    return Promise.resolve({
      url: localStorageUrl("upload", input.storageKey, expiresAt),
      expiresAt,
      headers: { "content-type": input.mimeType },
    });
  }

  public createMultipartUpload(input: {
    readonly storageKey: string;
  }): Promise<{ readonly providerUploadId: string; readonly metadata: Record<string, unknown> }> {
    return Promise.resolve({
      providerUploadId: `local-${randomBytes(12).toString("hex")}`,
      metadata: { storageKey: input.storageKey, emulatedMultipart: true },
    });
  }

  public createSignedPartUploadUrl(input: {
    readonly storageKey: string;
    readonly partNumber: number;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl> {
    const expiresAt = expiresAtFrom(input.expiresInSeconds);
    return Promise.resolve({
      url: localStorageUrl(
        "upload",
        `${input.storageKey}.part-${String(input.partNumber)}`,
        expiresAt,
      ),
      expiresAt,
      headers: {},
    });
  }

  public completeMultipartUpload(): Promise<Record<string, unknown>> {
    return Promise.resolve({ emulatedMultipart: true });
  }

  public abortMultipartUpload(): Promise<void> {
    return Promise.resolve();
  }

  public async verifyObject(storageKey: string): Promise<ObjectStorageVerification> {
    try {
      const filePath = this.resolveStoragePath(storageKey);
      const metadata = await stat(filePath);
      const bytes = await readFile(filePath);
      return {
        exists: true,
        sizeBytes: BigInt(metadata.size),
        mimeType: null,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        providerMetadata: { storage: "local" },
      };
    } catch {
      return {
        exists: false,
        sizeBytes: null,
        mimeType: null,
        checksumSha256: null,
        providerMetadata: {},
      };
    }
  }

  public createSignedDownloadUrl(input: {
    readonly storageKey: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl> {
    const expiresAt = expiresAtFrom(input.expiresInSeconds);
    return Promise.resolve({
      url: localStorageUrl("download", input.storageKey, expiresAt),
      expiresAt,
      headers: {},
    });
  }

  public async deleteObject(storageKey: string): Promise<void> {
    await rm(this.resolveStoragePath(storageKey), { force: true });
  }

  public async writeObject(storageKey: string, bytes: Uint8Array): Promise<void> {
    const filePath = this.resolveStoragePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
  }

  public async readObject(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStoragePath(storageKey));
  }

  private resolveStoragePath(storageKey: string): string {
    const safeKey = normalize(storageKey).replace(/^(\.\.[/\\])+/, "");
    const target = resolve(join(this.root, safeKey));
    const distance = relative(this.root, target);
    if (distance.startsWith("..") || distance === "" || extname(target).length === 0) {
      throw new Error("Invalid local storage key.");
    }
    return target;
  }
}

function expiresAtFrom(expiresInSeconds: number): Date {
  return new Date(Date.now() + Math.min(expiresInSeconds, LOCAL_URL_TTL_SECONDS) * 1000);
}

function localStorageUrl(
  action: "upload" | "download",
  storageKey: string,
  expiresAt: Date,
): string {
  const url = new URL(`/api/local-storage/${action}`, env.APP_URL);
  url.searchParams.set("key", storageKey);
  url.searchParams.set("expires", expiresAt.toISOString());
  url.searchParams.set("sig", signLocalStorageUrl(action, storageKey, expiresAt.toISOString()));
  return url.toString();
}

export function isValidLocalStorageSignature(input: {
  readonly action: "upload" | "download";
  readonly storageKey: string;
  readonly expires: string;
  readonly signature: string | null;
}): boolean {
  if (input.signature === null || new Date(input.expires).getTime() <= Date.now()) {
    return false;
  }
  const expected = signLocalStorageUrl(input.action, input.storageKey, input.expires);
  const received = Buffer.from(input.signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return received.length === expectedBytes.length && timingSafeEqual(received, expectedBytes);
}

function signLocalStorageUrl(
  action: "upload" | "download",
  storageKey: string,
  expires: string,
): string {
  const secret =
    env.ENCRYPTION_KEY_SECRET_REF ?? env.TOKEN_PEPPER_SECRET_REF ?? "aptly-local-storage";
  return createHmac("sha256", secret).update(`${action}\n${storageKey}\n${expires}`).digest("hex");
}
