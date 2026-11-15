import { Check, X, Shield, Sparkles } from "lucide-react";

interface ModComparisonMatrixProps {
  appName: string;
  category?: string;
  isPc?: boolean;
}

export function ModComparisonMatrix({
  appName,
  category = "Application",
  isPc = false,
}: ModComparisonMatrixProps) {
  const catLower = (category || "").toLowerCase();

  // Dynamic feature rows based on app category
  let comparisons = [
    {
      feature: "Advertisement Experience",
      original: "Intrusive video & banner ads",
      originalPass: false,
      modded: "100% Ad-Free (Zero ads)",
      moddedPass: true,
    },
    {
      feature: "Subscription Paywall",
      original: "Monthly subscription required",
      originalPass: false,
      modded: "All Pro / VIP features unlocked",
      moddedPass: true,
    },
    {
      feature: "Export & Audio/Video Quality",
      original: "Capped bitrates & resolution limits",
      originalPass: false,
      modded: "Maximum resolution & lossless bitrate",
      moddedPass: true,
    },
    {
      feature: "Watermarks & Export Restrictions",
      original: "Watermarks enabled on free exports",
      originalPass: false,
      modded: "No watermarks, clean exports",
      moddedPass: true,
    },
    {
      feature: "Installation & Activation",
      original: "Restricted regional availability",
      originalPass: false,
      modded: "Direct APK installation worldwide",
      moddedPass: true,
    },
  ];

  if (catLower.includes("music") || catLower.includes("audio")) {
    comparisons = [
      {
        feature: "Audio Advertisements",
        original: "Audio ads between songs",
        originalPass: false,
        modded: "100% Ad-Free uninterrupted playback",
        moddedPass: true,
      },
      {
        feature: "Skip Limits",
        original: "Limited to 6 skips per hour",
        originalPass: false,
        modded: "Unlimited song skips",
        moddedPass: true,
      },
      {
        feature: "Audio Streaming Quality",
        original: "Capped at standard (128kbps)",
        originalPass: false,
        modded: "Extreme 320kbps High-Fidelity",
        moddedPass: true,
      },
      {
        feature: "Track Selection & Seeking",
        original: "Shuffle-only mode on mobile",
        originalPass: false,
        modded: "Full on-demand track selection & scrub",
        moddedPass: true,
      },
      {
        feature: "Cost / Monthly Subscription",
        original: "₹119 - ₹179 / month",
        originalPass: false,
        modded: "100% Free Lifetime Access",
        moddedPass: true,
      },
    ];
  } else if (catLower.includes("video") || catLower.includes("photo")) {
    comparisons = [
      {
        feature: "Export Watermarks",
        original: "Watermark stamped on free exports",
        originalPass: false,
        modded: "Zero watermarks, pristine renders",
        moddedPass: true,
      },
      {
        feature: "Premium Filters & Presets",
        original: "Locked behind VIP subscription",
        originalPass: false,
        modded: "All premium filters & presets unlocked",
        moddedPass: true,
      },
      {
        feature: "4K 60FPS Video Export",
        original: "Resolution capped at 720p/1080p",
        originalPass: false,
        modded: "Full 4K Ultra HD 60fps export",
        moddedPass: true,
      },
      {
        feature: "Ad Disruption",
        original: "Popups upon opening & exporting",
        originalPass: false,
        modded: "Clean, zero ad interruptions",
        moddedPass: true,
      },
      {
        feature: "Subscription Cost",
        original: "₹299 - ₹999 / year",
        originalPass: false,
        modded: "100% Free Lifetime Access",
        moddedPass: true,
      },
    ];
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 block">
            Side-By-Side Comparison
          </span>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>Official Play Store vs AWTMods Edition</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span>Verified Safe APK</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <th className="py-3 px-3">Feature</th>
              <th className="py-3 px-3 text-red-500 dark:text-red-400">Play Store (Free)</th>
              <th className="py-3 px-3 text-emerald-500 font-bold bg-emerald-500/5 rounded-t-xl">
                AWTMods (Unlocked)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 font-medium">
            {comparisons.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-3.5 px-3 font-semibold text-foreground">
                  {item.feature}
                </td>
                <td className="py-3.5 px-3 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{item.original}</span>
                  </div>
                </td>
                <td className="py-3.5 px-3 bg-emerald-500/5 font-semibold text-foreground">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{item.modded}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
