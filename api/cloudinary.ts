import { v2 as cloudinary } from "cloudinary";
import { env } from "./config";

/** Uploads only work when all three Cloudinary credentials are present. */
export function isUploadConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

if (isUploadConfigured()) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string = env.CLOUDINARY_FOLDER
): Promise<{ url: string; publicId: string }> {
  if (!isUploadConfigured()) {
    throw new Error("Cloudinary credentials are not configured");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        public_id: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteFile(publicId: string): Promise<void> {
  if (!isUploadConfigured()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
}
