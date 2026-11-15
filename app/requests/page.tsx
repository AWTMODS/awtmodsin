import type { Metadata } from "next";
import { getModRequests } from "@/lib/db";
import { RequestsBoard } from "@/components/requests/requests-board";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Request a Mod | Community Board — AWTMods",
  description:
    "Request new modded Android apps, games, and PC software. Upvote community requests to prioritize the next releases.",
};

export const revalidate = 60;

export default async function RequestsPage() {
  const requests = await getModRequests();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Community Demand Board</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Request a Mod
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Can&apos;t find an app or game you want? Submit your request below or upvote existing community submissions to fast-track mod development.
        </p>
      </div>

      {/* Main Interactive Board */}
      <RequestsBoard initialRequests={requests} />
    </div>
  );
}
