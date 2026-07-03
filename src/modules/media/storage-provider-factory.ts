import { env } from "@/config";

import { LocalFilesystemStorageProvider } from "./local-storage-provider";
import { S3CompatibleObjectStorageProvider } from "./s3-storage-provider";

import type { ObjectStorageProvider } from "./types";

export function createObjectStorageProvider(): ObjectStorageProvider {
  if (env.STORAGE_PROVIDER === "local") {
    return new LocalFilesystemStorageProvider();
  }
  return new S3CompatibleObjectStorageProvider();
}
