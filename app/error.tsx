"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-24 sm:py-32 text-center">
      <div className="mx-auto w-16 h-16 rounded-3xl bg-secondary border border-border flex items-center justify-center text-foreground mb-6">
        <AlertTriangle className="w-8 h-8 text-warning" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-3">
        Something went wrong
      </h1>
      <p className="text-base text-muted-foreground max-w-md mx-auto mb-8">
        An unexpected error occurred while loading this page. You can try refreshing or returning to the homepage.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => reset()}
          variant="default"
          className="rounded-xl gap-2 font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
        <Link href="/">
          <Button variant="outline" className="rounded-xl gap-2 font-medium">
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
