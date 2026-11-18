import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";
import { TelegramJoinPopup } from "@/components/telegram-join-popup";
import { getSiteSettings } from "@/lib/db";
import { Analytics } from '@vercel/analytics/next';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://awtmodsin.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  referrer: "no-referrer",
  title: {
    default: "AWTMods — Download Modded Apps, Games & PC Software",
    template: "%s | AWTMods",
  },
  description:
    "Discover and download verified Android modded applications, premium APKs, modded games, and PC software. 100% clean, high-speed, and free mirrors.",
  keywords: [
    "AWTMods",
    "Modded APK",
    "Android Apps",
    "Premium APK",
    "Free Android Mods",
    "PC Software",
    "Windows Repacks",
    "Spotify Mod APK",
    "Minecraft Mod APK",
    "Verified APK",
  ],
  authors: [{ name: "AWTMods Team" }],
  creator: "AWTMods",
  publisher: "AWTMods",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "./",
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
    title: "AWTMods — Download Modded Apps, Games & PC Software",
    description:
      "Your trusted directory for Android modded applications, premium APKs, and verified PC software.",
    url: siteUrl,
    siteName: "AWTMods",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "AWTMods Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AWTMods — Download Modded Apps, Games & PC Software",
    description:
      "Discover and download verified Android modded applications, premium APKs, and PC software.",
    creator: "@awtmods",
    images: ["/icon.svg"],
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
        <Analytics />
      </body>
    </html>
  );
}
