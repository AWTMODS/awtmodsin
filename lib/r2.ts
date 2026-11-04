import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "3aa3beaf7fea2a73879df0c02a516526";
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

export const r2Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "awtmods-apks";
export const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_BASE_URL || `https://pub-${accountId}.r2.dev`;

/**
 * Generate a pre-signed PUT URL so the client can upload large APK files
 * directly to Cloudflare R2 without payload limit or server timeout.
 */
export async function generateR2PresignedUpload(
  filename: string,
  contentType = "application/vnd.android.package-archive"
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `apks/${Date.now()}-${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}

/**
 * Direct server buffer upload to R2
 */
export async function uploadBufferToR2(
  filename: string,
  buffer: Buffer,
  contentType = "application/vnd.android.package-archive"
): Promise<string> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `apks/${Date.now()}-${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);
  return `${R2_PUBLIC_URL}/${key}`;
}

