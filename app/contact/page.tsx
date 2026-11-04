import { Mail, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Contact Us",
  description: "Get in touch with the AWTMods administration team.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="space-y-4 mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Contact AWTMods
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Have an inquiry, partnership proposal, or publishing request? Reach out to our team.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <Mail className="h-6 w-6 text-foreground" />
          <h3 className="font-bold text-base text-foreground">Email Support</h3>
          <p className="text-xs text-muted-foreground">
            For general questions, DMCA notices, or press inquiries:
          </p>
          <a
            href="mailto:awtmods@gmail.com"
            className="inline-block text-sm font-semibold text-foreground underline"
          >
            awtmods@gmail.com
          </a>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <Send className="h-6 w-6 text-foreground" />
          <h3 className="font-bold text-base text-foreground">Telegram Community</h3>
          <p className="text-xs text-muted-foreground">
            Join our Telegram channel for direct announcements and feedback:
          </p>
          <a
            href="https://t.me/awtmods"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-semibold text-foreground underline"
          >
            @awtmods (Telegram)
          </a>
        </div>
      </div>
    </div>
  );
}

