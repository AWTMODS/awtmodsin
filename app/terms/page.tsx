export const metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for utilizing the AWTMods website and directory.",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground mb-4">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: October 2026</p>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
        <p>
          By accessing https://www.awtmods.in, you agree to comply with and be bound by these Terms of Service. If you disagree with any part of these terms, please do not use our website.
        </p>

        <h2 className="text-lg font-bold text-foreground">2. Use of Information</h2>
        <p>
          The materials and APK packages indexed on AWTMods are provided solely for personal, testing, educational, and non-commercial evaluation purposes. Users are responsible for complying with local regulations regarding software modification.
        </p>

        <h2 className="text-lg font-bold text-foreground">3. Limitation of Liability</h2>
        <p>
          AWTMods and its administrators shall not be liable for any device damage, account suspensions, or data loss resulting from the download or installation of third-party software.
        </p>
      </div>
    </div>
  );
}

