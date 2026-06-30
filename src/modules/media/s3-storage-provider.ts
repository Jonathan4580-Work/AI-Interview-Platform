import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/config";

import type { ObjectStorageProvider, ObjectStorageVerification, SignedUrl } from "./types";

const SIGNED_URL_TTL_SECONDS = 10 * 60;

export class S3CompatibleObjectStorageProvider implements ObjectStorageProvider {
  public readonly providerKey = env.OBJECT_STORAGE_PROVIDER;
  public readonly bucket = env.OBJECT_STORAGE_BUCKET;
  public readonly region = env.OBJECT_STORAGE_REGION;

  private readonly client = new S3Client({
    region: env.OBJECT_STORAGE_REGION,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    credentials:
      env.OBJECT_STORAGE_ACCESS_KEY_ID === undefined ||
      env.OBJECT_STORAGE_SECRET_ACCESS_KEY === undefined
        ? undefined
        : {
            accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
            secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
          },
  });

  public async createSignedUploadUrl(input: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly checksumSha256?: string | null;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      ContentType: input.mimeType,
      ChecksumSHA256: input.checksumSha256 ?? undefined,
    });
    return {
      url: await this.sign(command, input.expiresInSeconds),
      expiresAt: expiresAt(input.expiresInSeconds),
      headers: {
        "content-type": input.mimeType,
        ...(input.checksumSha256 === undefined || input.checksumSha256 === null
          ? {}
          : { "x-amz-checksum-sha256": input.checksumSha256 }),
      },
    };
  }

  public async createMultipartUpload(input: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly checksumSha256?: string | null;
  }): Promise<{ readonly providerUploadId: string; readonly metadata: Record<string, unknown> }> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.storageKey,
        ContentType: input.mimeType,
      }),
    );
    if (result.UploadId === undefined) {
      throw new Error("Object storage did not return a multipart upload ID.");
    }
    return {
      providerUploadId: result.UploadId,
      metadata: {
        bucket: result.Bucket ?? this.bucket,
        key: result.Key ?? input.storageKey,
      },
    };
  }

  public async createSignedPartUploadUrl(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
    readonly partNumber: number;
    readonly expiresInSeconds: number;
  }): Promise<SignedUrl> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      UploadId: input.providerUploadId,
      PartNumber: input.partNumber,
    });
    return {
      url: await this.sign(command, input.expiresInSeconds),
      expiresAt: expiresAt(input.expiresInSeconds),
      headers: {},
    };
  }

  public async completeMultipartUpload(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
    readonly parts: readonly { readonly partNumber: number; readonly etag: string }[];
  }): Promise<Record<string, unknown>> {
    const result = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.storageKey,
        UploadId: input.providerUploadId,
        MultipartUpload: {
          Parts: input.parts
            .slice()
            .sort((left, right) => left.partNumber - right.partNumber)
            .map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag,
            })),
        },
      }),
    );
    return {
      bucket: result.Bucket ?? this.bucket,
      key: result.Key ?? input.storageKey,
      etag: result.ETag ?? null,
      location: result.Location ?? null,
    };
  }

  public async abortMultipartUpload(input: {
    readonly storageKey: string;
    readonly providerUploadId: string;
  }): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: input.storageKey,
        UploadId: input.providerUploadId,
      }),
    );
  }

  public async verifyObject(storageKey: string): Promise<ObjectStorageVerification> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
      return {
        exists: true,
        sizeBytes: result.ContentLength === undefined ? null : BigInt(result.ContentLength),
        mimeType: result.ContentType ?? null,
        checksumSha256: result.ChecksumSHA256 ?? null,
        providerMetadata: {
          etag: result.ETag ?? null,
          versionId: result.VersionId ?? null,
        },
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

  public async createSignedDownloadUrl(input: {
    readonly storageKey: string;
    readonly expiresInSeconds: number;
    readonly contentDisposition?: string | null;
  }): Promise<SignedUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.storageKey,
      ResponseContentDisposition: input.contentDisposition ?? undefined,
    });
    return {
      url: await this.sign(command, input.expiresInSeconds),
      expiresAt: expiresAt(input.expiresInSeconds),
      headers: {},
    };
  }

  public async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );
  }

  private sign(command: unknown, expiresInSeconds: number) {
    return getSignedUrl(this.client as never, command as never, {
      expiresIn: Math.min(expiresInSeconds, SIGNED_URL_TTL_SECONDS),
    });
  }
}

function expiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + Math.min(expiresInSeconds, SIGNED_URL_TTL_SECONDS) * 1000);
}
