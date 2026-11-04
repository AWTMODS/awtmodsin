"use client";

import { useState } from "react";
import { Star, MessageSquarePlus, CheckCircle2, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { ApplicationReview } from "@/lib/types";

interface ReviewsSectionProps {
  applicationId: string;
  appName: string;
  initialReviews: ApplicationReview[];
  currentRating: number;
  currentReviewsCount: number;
}

export function ReviewsSection({
  applicationId,
  appName,
  initialReviews = [],
  currentRating = 0,
  currentReviewsCount = 0,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<ApplicationReview[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [userName, setUserName] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Compute live averages based on state reviews or props
  const totalReviews = reviews.length > 0 ? reviews.length : currentReviewsCount;
  const avgRating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
      : Number(currentRating || 0);

  // Calculate rating distribution for 5, 4, 3, 2, 1 stars
  const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    }
  });

  const ratingLabels: Record<number, string> = {
    1: "Terrible",
    2: "Poor",
    3: "Average",
    4: "Good",
    5: "Excellent!",
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      toast.error("Please enter your name or nickname");
      return;
    }
    if (userName.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a review comment");
      return;
    }
    if (comment.trim().length < 3) {
      toast.error("Review comment must be at least 3 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          userName: userName.trim(),
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      // Prepend review to live state
      const newReview: ApplicationReview = data.review || {
        id: `rev-${Date.now()}`,
        application_id: applicationId,
        user_name: userName.trim(),
        rating,
        comment: comment.trim(),
        created_at: new Date().toISOString(),
      };

      setReviews((prev) => [newReview, ...prev]);
      setUserName("");
      setComment("");
      setShowForm(false);
      toast.success("Review submitted successfully! Thank you for your feedback.");
    } catch (err: any) {
      toast.error(err.message || "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="reviews" className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-8 scroll-mt-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              User Reviews & Ratings
            </h2>
            <Badge variant="secondary" className="font-semibold text-xs">
              {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real feedback and ratings submitted by verified AWTMods users
          </p>
        </div>

        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
          className="rounded-xl px-5 gap-2 font-semibold shadow-xs"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>{showForm ? "Close Review Form" : "Write a Review"}</span>
        </Button>
      </div>

      {/* Review Submission Form Drawer */}
      {showForm && (
        <form
          onSubmit={handleSubmitReview}
          className="rounded-2xl border border-border bg-secondary/30 p-5 sm:p-6 space-y-5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">
              Leave a Review for {appName}
            </h3>
            <span className="text-xs font-semibold text-amber-500">
              {ratingLabels[hoverRating || rating]}
            </span>
          </div>

          {/* Interactive Star Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Your Rating
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 rounded-lg hover:bg-secondary transition-all active:scale-90"
                      title={`${star} Star - ${ratingLabels[star]}`}
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          isActive
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/40 hover:text-muted-foreground"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-sm font-bold text-foreground ml-2">
                {(hoverRating || rating).toFixed(1)} / 5.0
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Your Name / Nickname <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Aadith or Anon Gamer"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={50}
                required
                className="rounded-xl bg-card"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Your Review & Experience <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="How did this APK perform on your device? Mention your Android version, game smoothness, or mod features."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              required
              className="rounded-xl bg-card resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="rounded-xl px-6 font-bold gap-2 shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submit Review</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Ratings Breakdown Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border/60 bg-secondary/20 p-5 sm:p-6">
        {/* Left Score Box */}
        <div className="md:col-span-4 text-center md:text-left flex flex-col items-center md:items-start justify-center border-b md:border-b-0 md:border-r border-border/70 pb-6 md:pb-0 md:pr-6">
          <div className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
            {avgRating > 0 ? avgRating.toFixed(1) : "0.0"}
          </div>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 sm:h-5 sm:w-5 ${
                  star <= Math.round(avgRating)
                    ? "text-amber-500 fill-amber-500"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {totalReviews > 0
              ? `Based on ${totalReviews} verified community ${totalReviews === 1 ? "review" : "reviews"}`
              : "No ratings yet. Be the first to review!"}
          </p>
        </div>

        {/* Right Star Percentage Bars */}
        <div className="md:col-span-8 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars] || 0;
            const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-7 text-right font-semibold text-muted-foreground flex items-center justify-end gap-0.5">
                  <span>{stars}</span>
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-9 text-right font-mono text-muted-foreground">
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border bg-card">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground mb-3">
              <Star className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-foreground">No Reviews Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              Download and test {appName}. Share your feedback to help the AWTMods community know how it runs!
            </p>
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              size="sm"
              className="rounded-xl px-5 gap-2 font-semibold"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>Write the First Review</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {reviews.map((rev) => (
              <div key={rev.id} className="py-5 first:pt-2 last:pb-2 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase shrink-0">
                      {rev.user_name ? rev.user_name.slice(0, 2) : <User className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {rev.user_name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Verified</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        {formatDate(rev.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Review Score Stars */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= rev.rating
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed pl-12">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

