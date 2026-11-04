import { NextResponse } from "next/server";
import { generateR2PresignedUpload } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 credentials are missing in .env.local. Please ensure R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are set.",
        },
        { status: 503 }
      );
    }

    const { filename, contentType } = await req.json();

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    const { uploadUrl, publicUrl, key } = await generateR2PresignedUpload(
      filename,
      contentType || "application/vnd.android.package-archive"
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (err: any) {
    console.error("R2 presign error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate R2 upload URL" },
      { status: 500 }
    );
  }
}

