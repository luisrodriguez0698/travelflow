import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3Client = createS3Client();
const { bucketName } = getBucketConfig();

// ── URL pública directa (R2 bucket público) ───────────────────────────────────
// Usa R2_PUBLIC_URL (ej: https://pub-xxx.r2.dev  o dominio personalizado)
export function getPublicFileUrl(cloudPath: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${cloudPath}`;
}

// ── Presigned URL para subir (el caller construye el cloudPath) ───────────────
export async function generatePresignedUploadUrl(
  _fileName: string,
  contentType: string,
  cloudPath: string
): Promise<{ uploadUrl: string; cloud_storage_path: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloudPath,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return {
    uploadUrl,
    cloud_storage_path: cloudPath,
    publicUrl: getPublicFileUrl(cloudPath),
  };
}

// ── URL de acceso para archivos privados (dashboard interno) ──────────────────
// Para archivos públicos ya se usa getPublicFileUrl directamente.
export async function getFileUrl(
  cloud_storage_path: string,
  _isPublic: boolean = false
): Promise<string> {
  // Si ya es una URL completa (almacenada en la BD tras la migración), devolverla tal cual
  if (
    cloud_storage_path.startsWith("http://") ||
    cloud_storage_path.startsWith("https://")
  ) {
    return cloud_storage_path;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// ── Eliminar archivo ──────────────────────────────────────────────────────────
export async function deleteFile(cloud_storage_path: string): Promise<void> {
  // No hacer nada si es URL externa
  if (
    cloud_storage_path.startsWith("http://") ||
    cloud_storage_path.startsWith("https://")
  ) {
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });

  await s3Client.send(command);
}
