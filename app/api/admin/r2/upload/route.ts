import { NextResponse } from "next/server";
import { uploadBufferToR2 } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 credentials are missing. Please ensure R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are set.",
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadBufferToR2(
      file.name,
      buffer,
      file.type || "application/vnd.android.package-archive"
    );

    return NextResponse.json({
      success: true,
      publicUrl,
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });
  } catch (err: any) {
    console.error("R2 direct upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload file to Cloudflare R2" },
      { status: 500 }
    );
  }
}

