import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3Client = createS3Client();
const { bucketName, folderPrefix } = getBucketConfig();

// Generate presigned URL for single-part upload (≤100MB)
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const timestamp = Date.now();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${fileName}`
    : `${folderPrefix}uploads/${timestamp}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

// Initiate multipart upload (>100MB)
export async function initiateMultipartUpload(
  fileName: string,
  isPublic: boolean = false
): Promise<{ uploadId: string; cloud_storage_path: string }> {
  const timestamp = Date.now();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${fileName}`
    : `${folderPrefix}uploads/${timestamp}-${fileName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentDisposition: isPublic ? "attachment" : undefined
  });

  const response = await s3Client.send(command);
  return { uploadId: response.UploadId!, cloud_storage_path };
}

// Get presigned URL for part upload
export async function getPresignedUrlForPart(
  cloud_storage_path: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    PartNumber: partNumber
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Complete multipart upload
export async function completeMultipartUpload(
  cloud_storage_path: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts }
  });

  await s3Client.send(command);
}

// Get file URL (always presigned for Railway Buckets, which are private)
export async function getFileUrl(
  cloud_storage_path: string,
  _isPublic: boolean = false
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Delete file
export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path
  });

  await s3Client.send(command);
}
