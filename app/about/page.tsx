import { ShieldCheck, Zap, Layers, Lock } from "lucide-react";

export const metadata = {
  title: "About Us",
  description: "Learn more about AWTMods, our mission, standards, and publishing integrity.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="space-y-4 mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          About AWTMods
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          AWTMods (https://www.awtmods.in) is an independent Android application publishing directory focused on unlocking superior mobile experiences, open-source utilities, and authorized modifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-border">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg text-foreground">Integrity & Verification</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every build is analyzed for package tampering, adware injection, and malicious payloads before receiving publishing approval. SHA-256 checksums are recorded for public transparency.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-border">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg text-foreground">High-Speed Multi-Mirrors</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We provide fast, reliable download mirrors across MediaFire, Google Drive, MEGA, Dropbox, and direct channels, so you never get stuck behind dead download links.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-border">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg text-foreground">Zero Friction & Privacy</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Visitors are never required to register, sign in, or pay. Access to Android tools and applications is completely open, safe, and free.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-border">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg text-foreground">Active Community Maintenance</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Our active Telegram community directly reports updates, broken links, and suggests new application releases.
          </p>
        </div>
      </div>
    </div>
  );
}

