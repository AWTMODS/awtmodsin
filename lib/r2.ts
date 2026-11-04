import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "./env";

export function getR2Config() {
  const accountId = getEnv("R2_ACCOUNT_ID", "3aa3beaf7fea2a73879df0c02a516526");
  const endpoint = getEnv("R2_ENDPOINT", `https://${accountId}.r2.cloudflarestorage.com`);
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID", "09f923767decc8bf4d1ca3d96741cfdf");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY", "c11f09735f1fdc596d7ec20dd66b187dfdb2a40004618ffdf9beab76091a92fc");
  const bucket = getEnv("R2_BUCKET_NAME", "awtmods-apks");
  const publicBaseUrl = getEnv("R2_PUBLIC_BASE_URL", `https://pub-${accountId}.r2.dev`);

  return { accountId, endpoint, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function getR2Client(): S3Client {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Generate a pre-signed PUT URL so the client can upload large APK files
 * directly to Cloudflare R2 without payload limit or server timeout.
 */
export async function generateR2PresignedUpload(
  filename: string,
  contentType = "application/vnd.android.package-archive"
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const { bucket, publicBaseUrl } = getR2Config();
  const client = getR2Client();

  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `apks/${Date.now()}-${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = `${publicBaseUrl}/${key}`;

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
  const { bucket, publicBaseUrl } = getR2Config();
  const client = getR2Client();

  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `apks/${Date.now()}-${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  return `${publicBaseUrl}/${key}`;
}
