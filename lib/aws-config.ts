import { S3Client } from "@aws-sdk/client-s3";

// Variable names match Railway's "AWS SDK (Generic)" preset:
// AWS_S3_BUCKET_NAME, AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_S3_BUCKET_NAME ?? "",
    folderPrefix: process.env.BUCKET_FOLDER_PREFIX ?? ""
  };
}

export function createS3Client() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_DEFAULT_REGION ?? "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn("Railway Bucket credentials not configured. File uploads will fail.");
    return new S3Client({ region });
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}
