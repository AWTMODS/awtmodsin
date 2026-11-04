export const metadata = {
  title: "Disclaimer",
  description: "Legal disclaimer regarding third-party Android packages and intellectual property.",
};

export default function DisclaimerPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground mb-4">Disclaimer</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: October 2026</p>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <p>
          AWTMods is a technology directory that indexes freely available Android application packages, developer releases, and community modifications. All registered trademarks, company names, product names, and brand logos mentioned on this website belong to their respective copyright holders.
        </p>

        <p>
          AWTMods does not claim ownership over third-party trademarks or proprietary software. Application modifications are developed by third-party developer communities and shared for educational, customization, and non-commercial utility purposes.
        </p>

        <p>
          Users download and install third-party APK packages at their own discretion. AWTMods does not warrant uninterrupted, error-free operation of external third-party modifications.
        </p>
      </div>
    </div>
  );
}

