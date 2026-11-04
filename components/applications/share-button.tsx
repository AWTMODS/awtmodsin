"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ShareButton({
  appName,
  className,
}: {
  appName: string;
  className?: string;
}) {
  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${appName} Mod APK Download`,
          text: `Check out ${appName} on AWTMods!`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleShare}
      className={cn("rounded-2xl gap-2 font-medium border-border", className)}
      title="Share app"
    >
      <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="hidden sm:inline">Share</span>
    </Button>
  );
}

