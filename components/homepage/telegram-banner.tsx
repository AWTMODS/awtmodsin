import { Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TelegramBannerProps {
  telegramUrl?: string;
}

export function TelegramBanner({
  telegramUrl,
}: TelegramBannerProps = {}) {
  const safeUrl = telegramUrl || "https://t.me/awtmods";

  return (
    <section className="py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 text-white p-8 sm:p-10 shadow-xl">
          {/* Subtle geometric background pattern */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white text-black flex items-center justify-center shrink-0 shadow-md">
                <Send className="h-7 w-7 text-black stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Join Our Telegram Channel
                </h3>
                <p className="text-sm text-neutral-300 max-w-lg">
                  Get instant updates, new releases and exclusive mod requests directly on our official Telegram channel.
                </p>
              </div>
            </div>

            <a
              href={safeUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
            >
              <Button
                size="lg"
                className="bg-white text-black hover:bg-neutral-100 font-semibold rounded-2xl px-7 gap-2 shadow-sm"
              >
                <span>Join Now</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
