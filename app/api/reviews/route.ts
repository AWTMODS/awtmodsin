import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createApplicationReview, getApplicationReviews, getApplicationById } from "@/lib/db";
import { cleanAppSlug } from "@/lib/utils";

const reviewSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  userName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating cannot exceed 5 stars"),
  comment: z
    .string()
    .min(3, "Review must be at least 3 characters")
    .max(1000, "Review cannot exceed 1,000 characters"),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    if (!appId) {
      return NextResponse.json({ error: "appId parameter is required" }, { status: 400 });
    }

    const reviews = await getApplicationReviews(appId);
    return NextResponse.json({ reviews });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = reviewSchema.parse(body);

    const review = await createApplicationReview(validated);
    if (!review) {
      return NextResponse.json(
        { error: "Failed to submit review. Please try again." },
        { status: 500 }
      );
    }

    // Attempt to revalidate the app detail page
    try {
      const app = await getApplicationById(validated.applicationId);
      if (app?.slug) {
        const clean = cleanAppSlug(app.slug);
        revalidatePath(`/apps/${clean}`);
        revalidatePath(`/apps/${clean}.html`);
      }
      revalidatePath("/");
    } catch {
      // Revalidation error can be safely ignored
    }

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}
