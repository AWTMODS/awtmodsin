export const metadata = {
  title: "DMCA Copyright Notice",
  description: "Digital Millennium Copyright Act compliance and takedown notice procedure.",
};

export default function DmcaPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground mb-4">
        DMCA Copyright Notice & Takedown
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: October 2026</p>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <p>
          AWTMods complies with 17 U.S.C. § 512 and the Digital Millennium Copyright Act (&ldquo;DMCA&rdquo;). It is our policy to respond to any infringement notices and take appropriate actions under the Digital Millennium Copyright Act and other applicable intellectual property laws.
        </p>

        <h2 className="text-lg font-bold text-foreground">Filing a DMCA Takedown Request</h2>
        <p>
          If your copyrighted material has been indexed on AWTMods and you wish to have this material removed, you must provide a written communication that details the following:
        </p>

        <ul className="list-disc pl-5 space-y-2">
          <li>Evidence of the authorized person to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
          <li>Sufficient contact information, including a valid email address and legal entity name.</li>
          <li>Direct URL identification of the material that is claimed to be infringing.</li>
          <li>A statement that the complaining party has a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
        </ul>

        <div className="rounded-2xl border border-border bg-card p-5 mt-6">
          <h3 className="font-semibold text-foreground mb-1">Send DMCA Notices To:</h3>
          <p className="font-mono text-sm text-foreground">Email: awtmods@gmail.com</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please allow up to 48 hours for verified removal requests.
          </p>
        </div>
      </div>
    </div>
  );
}

