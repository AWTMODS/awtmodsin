import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  folder = "awtmods"
): Promise<{ url: string; public_id: string; format: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" }, // Automatic modern format (AVIF/WebP) & compression
        ],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

export default cloudinary;
