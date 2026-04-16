import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-compatible storage
// Env vars required:
//   AWS_ENDPOINT_URL     → https://{ACCOUNT_ID}.r2.cloudflarestorage.com
//   AWS_S3_BUCKET_NAME   → nombre del bucket (ej: travelflow-files)
//   AWS_ACCESS_KEY_ID    → R2 API Token Access Key ID
//   AWS_SECRET_ACCESS_KEY→ R2 API Token Secret Access Key
//   AWS_DEFAULT_REGION   → auto
//   R2_PUBLIC_URL        → URL pública del bucket (ej: https://pub-xxx.r2.dev)

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_S3_BUCKET_NAME ?? "",
  };
}

export function createS3Client() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_DEFAULT_REGION ?? "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn("R2 credentials not configured. File uploads will fail.");
    return new S3Client({ region });
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // requerido para R2
  });
}
