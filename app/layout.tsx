import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.awtmods.in"),
  title: {
    default: "AWTMods — Download Modded Apps & Premium APKs",
    template: "%s | AWTMods",
  },
  description:
    "Discover and download verified Android modded applications, premium APKs, tools, and unlocked features. Safe, fast, and free download mirrors.",
  keywords: [
    "AWTMods",
    "Modded APK",
    "Android Apps",
    "Premium APK",
    "Free Android Mods",
    "Spotify Mod APK",
    "YouTube Premium APK",
    "Instagram Mod",
  ],
  authors: [{ name: "AWTMods Team" }],
  openGraph: {
    title: "AWTMods — Download Modded Apps & Premium APKs",
    description:
      "Your trusted directory for Android modded applications and premium unlocked APKs.",
    url: "https://www.awtmods.in",
    siteName: "AWTMods",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AWTMods Publishing Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--card-foreground)",
                border: "1px solid var(--border)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
