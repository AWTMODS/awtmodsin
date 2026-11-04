import Link from "next/link";
import { Logo } from "./logo";
import { Send, Instagram, Youtube, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground transition-colors mt-auto">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <Logo size="md" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your trusted source for Android modded apps, premium APKs, tools, and unlocked features. Safe, fast and free.
            </p>
            <div className="flex items-center gap-3 pt-2 text-muted-foreground">
              <a
                href="https://t.me/awtmods"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                aria-label="Telegram"
              >
                <Send className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/awtmods"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://youtube.com/@awtmods"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                aria-label="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/awtmods"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                aria-label="Twitter / X"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/apps" className="hover:text-foreground transition-colors">
                  All Apps
                </Link>
              </li>
              <li>
                <Link href="/games" className="hover:text-foreground transition-colors">
                  Modded Games
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-foreground transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/updates" className="hover:text-foreground transition-colors">
                  Latest Updates
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Community */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">
              Support
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground transition-colors">
                  About AWTMods
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/report-issue" className="hover:text-foreground transition-colors">
                  Report Broken Link
                </Link>
              </li>
              <li>
                <a
                  href="https://t.me/awtmods"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Join Telegram
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-foreground">
              Legal & Safety
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="hover:text-foreground transition-colors">
                  DMCA Copyright
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-foreground transition-colors">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} AWTMods.in. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

