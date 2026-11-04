import { NextResponse } from "next/server";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    // Check if Cloudinary credentials are configured
    const hasCloudinaryUrl = !!process.env.CLOUDINARY_URL;
    const hasIndividualKeys =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    if (!hasCloudinaryUrl && !hasIndividualKeys) {
      return NextResponse.json(
        {
          error:
            "Cloudinary credentials not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env.local file.",
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "awtmods";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in upload request" },
        { status: 400 }
      );
    }

    // Verify file is an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files (PNG, JPG, WebP, AVIF) are supported." },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary with auto-compression & optimization
    const uploadResult = await uploadImageToCloudinary(buffer, `awtmods/${folder}`);

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
    });
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload image to Cloudinary" },
      { status: 500 }
    );
  }
}

