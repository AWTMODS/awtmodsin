import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";
import { TelegramJoinPopup } from "@/components/telegram-join-popup";
import { RealtimeSync } from "@/components/realtime-sync";
import { getSiteSettings } from "@/lib/db";
import { SITE_URL, SITE_NAME, DEFAULT_SEO } from "@/lib/seo";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: DEFAULT_SEO.title,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_SEO.description,
  keywords: DEFAULT_SEO.keywords,
  authors: [{ name: "AWTMods Team" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    url: siteUrl,
    siteName: SITE_NAME,
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "AWTMods Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    creator: "@awtmods",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings().catch(() => null);

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--card-foreground)",
                border: "1px solid var(--border)",
              },
            }}
          />
          <RealtimeSync />
          <TelegramJoinPopup
            telegramUrl={settings?.telegramUrl || "https://t.me/awtmods"}
            enabled={settings?.telegramPopupEnabled !== false}
            delaySeconds={settings?.telegramPopupDelay ?? 1}
            title={settings?.telegramPopupTitle || "Join our Telegram"}
            description={
              settings?.telegramPopupDesc ||
              "Get new premium unlocked apps first, plus update alerts and support from the community."
            }
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
