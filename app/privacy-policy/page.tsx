export const metadata = {
  title: "Privacy Policy",
  description: "AWTMods Privacy Policy regarding data handling and visitor safety.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 prose prose-neutral dark:prose-invert">
      <h1 className="text-3xl font-extrabold text-foreground mb-4">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: October 2026</p>

      <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-bold text-foreground">1. Information We Do Not Collect</h2>
        <p>
          AWTMods does not require user registration or personal account creation. We do not collect names, credit card numbers, or personal billing addresses.
        </p>

        <h2 className="text-lg font-bold text-foreground">2. Analytical & Log Data</h2>
        <p>
          To maintain server integrity and prevent automated denial of service attacks, our servers may log anonymous technical data including browser user agent, truncated IP addresses for rate limiting, and timestamped download requests.
        </p>

        <h2 className="text-lg font-bold text-foreground">3. External Links</h2>
        <p>
          Our platform aggregates download mirrors across external providers (such as Google Drive, MediaFire, MEGA). Visitors who choose to access external providers are governed by the privacy policies and terms of those respective platforms.
        </p>

        <h2 className="text-lg font-bold text-foreground">4. Contact Us</h2>
        <p>
          For privacy inquiries, please contact us at <a href="mailto:awtmods@gmail.com" className="text-foreground underline">awtmods@gmail.com</a>.
        </p>
      </section>
    </div>
  );
}

