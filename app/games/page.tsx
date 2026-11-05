import { getApplications, getCategories } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import { Gamepad2, Sparkles } from "lucide-react";

export const metadata = {
  title: "Modded Android Games & APKs",
  description: "Download verified modded Android games with unlocked levels, coins, and premium content.",
};

export const revalidate = 60;

export default async function GamesPage() {
  const { applications: gameApps } = await getApplications({
    categorySlug: "games",
    limit: 24,
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner for Games */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12 mb-10">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-semibold text-foreground border border-border">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span>Gaming Zone</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Modded Android Games
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Download high performance modded Android games with infinite currency, unlocked characters, no advertisements, and 120 FPS high refresh rate unlocked.
          </p>
        </div>
      </div>

      {/* Games List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            Available Games ({gameApps.length})
          </h2>
        </div>

        {gameApps.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-card/30">
            <Gamepad2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">No games published yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon as our catalog is continually refreshed with new modded games.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {gameApps.map((game) => (
              <AppCard key={game.id} app={game} variant="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

