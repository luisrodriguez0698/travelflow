/**
 * Script to configure CORS on Railway Bucket for browser-based file uploads.
 * Run once after creating the bucket:
 *   npx tsx scripts/setup-bucket-cors.ts
 *
 * Required env vars (Railway "AWS SDK Generic" preset):
 *   AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL, AWS_DEFAULT_REGION
 */
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config();

const endpoint = process.env.AWS_ENDPOINT_URL;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const region = process.env.AWS_DEFAULT_REGION ?? "auto";

if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing required environment variables:");
  console.error("  AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

async function main() {
  console.log(`Configuring CORS on bucket: ${bucketName}`);

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  console.log("CORS configured successfully!");
  console.log("Allowed origins: * (update to your domain for production)");
}

main().catch((err) => {
  console.error("Failed to configure CORS:", err.message);
  process.exit(1);
});
