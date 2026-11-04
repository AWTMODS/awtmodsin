"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Application } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReportFormClientProps {
  applications: Application[];
  initialAppSlug?: string;
  initialType?: string;
  initialVersion?: string;
}

export function ReportFormClient({
  applications,
  initialAppSlug,
  initialType = "broken_link",
  initialVersion,
}: ReportFormClientProps) {
  const selectedApp = applications.find((a) => a.slug === initialAppSlug);

  const [appId, setAppId] = useState(selectedApp?.id || "");
  const [reportType, setReportType] = useState(initialType);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    initialVersion ? `Link unavailable for version ${initialVersion}. ` : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a description of the issue");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: appId || null,
          report_type: reportType,
          email: email || null,
          message,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit report");

      setSubmitted(true);
      toast.success("Thank you! Your report has been submitted.");
    } catch {
      toast.error("An error occurred while submitting the report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Report Received</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Thank you for helping keep AWTMods clean and functional. Our administrative team will review this shortly.
        </p>
        <Button
          onClick={() => {
            setSubmitted(false);
            setMessage("");
          }}
          variant="outline"
          className="mt-4"
        >
          Submit another report
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Target Application */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-foreground">
          Related Application (Optional)
        </label>
        <select
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">-- General Website Issue / Unspecified --</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name} ({app.latest_version?.version_name || "v1.0"})
            </option>
          ))}
        </select>
      </div>

      {/* Report Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-foreground">
          Issue Category
        </label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="broken_link">Broken or Unavailable Download Link</option>
          <option value="outdated_version">Outdated Version / Update Request</option>
          <option value="incorrect_info">Incorrect App Specifications</option>
          <option value="security">Security or Integrity Concern</option>
          <option value="dmca">DMCA / Copyright Inquiry</option>
          <option value="other">Other Inquiry</option>
        </select>
      </div>

      {/* Contact Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-foreground">
          Your Email (Optional, for updates)
        </label>
        <Input
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl"
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-foreground">
          Detailed Description <span className="text-destructive">*</span>
        </label>
        <Textarea
          rows={4}
          placeholder="Please describe which mirror failed, any error message received, or details of your request..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className="rounded-xl"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        size="lg"
        className="w-full rounded-xl font-bold gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Submitting...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>Submit Report</span>
          </>
        )}
      </Button>
    </form>
  );
}

