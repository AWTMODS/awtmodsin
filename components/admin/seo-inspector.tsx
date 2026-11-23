"use client";

import { useState } from "react";
import { Application } from "@/lib/types";
import { cleanAppSlug } from "@/lib/utils";
import { SITE_URL, sanitizeMetaDescription } from "@/lib/seo";
import {
  Search,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Smartphone,
  Monitor,
  Sparkles,
} from "lucide-react";

interface SeoInspectorProps {
  appName: string;
  slug: string;
  description: string;
  shortDescription?: string;
  iconUrl?: string;
  versionName?: string;
  isPc?: boolean;
  developer?: string;
  categoryName?: string;
}

export function SeoInspector({
  appName,
  slug,
  description,
  shortDescription,
  iconUrl,
  versionName = "Latest",
  isPc = false,
  developer = "Aadith C V",
  categoryName,
}: SeoInspectorProps) {
  const [activeTab, setActiveTab] = useState<"google" | "social" | "audit">("google");

  const cleanSlug = cleanAppSlug(slug) || "example-app";
  const canonicalUrl = `${SITE_URL}/apps/${cleanSlug}.html`;
  const seoTitle = isPc
    ? `${appName || "App Name"} (${versionName}) Download for PC Windows | AWTMods`
    : `${appName || "App Name"} (${versionName}) APK Download – Latest Version | AWTMods`;

  const cleanDesc = sanitizeMetaDescription(shortDescription || description, 155);
  const seoSnippet =
    cleanDesc.length > 20
      ? cleanDesc
      : `Download ${appName || "this app"} (${versionName}) ${
          isPc ? "for PC Windows" : "APK for Android"
        }. Explore full app information, features, and verified high-speed mirrors at AWTMods.`;

  // Audit calculations
  const titleLen = seoTitle.length;
  const descLen = seoSnippet.length;

  const checks = [
    {
      label: "SEO Title Length",
      status: titleLen >= 40 && titleLen <= 65 ? "pass" : titleLen < 40 ? "warn" : "fail",
      detail: `${titleLen} characters (Recommended: 45-60)`,
    },
    {
      label: "Meta Description Length",
      status: descLen >= 120 && descLen <= 160 ? "pass" : descLen < 120 ? "warn" : "fail",
      detail: `${descLen} characters (Recommended: 120-160)`,
    },
    {
      label: "Canonical URL",
      status: canonicalUrl.endsWith(".html") && !canonicalUrl.includes("vercel") ? "pass" : "warn",
      detail: canonicalUrl,
    },
    {
      label: "Application Icon",
      status: iconUrl ? "pass" : "fail",
      detail: iconUrl ? "Icon configured & active" : "Missing icon image",
    },
    {
      label: "Content Depth",
      status: (description || "").length > 150 ? "pass" : "warn",
      detail: `${(description || "").length} characters of description`,
    },
    {
      label: "Developer Attribution",
      status: developer && developer !== "Aadith C V" ? "pass" : "warn",
      detail: developer || "Generic developer name",
    },
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-base text-foreground">
              Real-Time Search & Social SEO Engine
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Simulates Google search result snippets, social card previews, and technical schema health.
          </p>
        </div>

        {/* SEO Score Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              score >= 80
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : score >= 50
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
            }`}
          >
            SEO Health: {score}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border w-fit text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("google")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "google"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-3.5 w-3.5 text-primary" />
          <span>Google SERP Preview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("social")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "social"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="h-3.5 w-3.5 text-sky-400" />
          <span>Social Sharing Card</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "audit"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Technical Audit ({passCount}/{checks.length})</span>
        </button>
      </div>

      {/* View A: Google SERP Preview */}
      {activeTab === "google" && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white text-neutral-900 border border-neutral-200 dark:bg-[#202124] dark:text-[#e8eaed] dark:border-[#3c4043] font-sans">
            <div className="flex items-center gap-2 mb-1.5">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={appName}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : (
                <div className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center justify-center font-bold">
                  A
                </div>
              )}
              <div className="flex flex-col text-[12px] leading-tight text-neutral-600 dark:text-[#bdc1c6] truncate">
                <span className="font-medium text-neutral-800 dark:text-[#dadce0]">
                  AWTMods
                </span>
                <span className="text-[11px] truncate opacity-90">{canonicalUrl}</span>
              </div>
            </div>

            <div className="text-[18px] sm:text-[20px] font-normal text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer leading-snug line-clamp-2">
              {seoTitle}
            </div>

            <div className="text-[13px] sm:text-[14px] text-[#4d5156] dark:text-[#bdc1c6] mt-1 leading-relaxed line-clamp-2">
              {seoSnippet}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Title: {titleLen}/65 chars</span>
            <span>Snippet: {descLen}/160 chars</span>
          </div>
        </div>
      )}

      {/* View B: Social Sharing Card Preview */}
      {activeTab === "social" && (
        <div className="max-w-md rounded-2xl border border-border overflow-hidden bg-secondary/40">
          <div className="relative h-44 bg-neutral-900 flex items-center justify-center p-4 overflow-hidden border-b border-border">
            {iconUrl ? (
              <div className="flex items-center gap-4">
                <img
                  src={iconUrl}
                  alt={appName}
                  className="h-20 w-20 rounded-2xl shadow-lg border border-border/50 object-cover"
                />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                    AWTMODS.IN • APK RELEASE
                  </div>
                  <div className="text-lg font-bold text-white line-clamp-1">
                    {appName}
                  </div>
                  <div className="text-xs text-neutral-400">Version: {versionName}</div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="font-bold text-white text-base">AWTMods</div>
                <div className="text-xs text-neutral-400">Fast & Verified Downloads</div>
              </div>
            )}
          </div>
          <div className="p-3.5 space-y-1 bg-card">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
              awtmods.in
            </div>
            <div className="text-sm font-bold text-foreground line-clamp-1">
              {seoTitle}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {seoSnippet}
            </div>
          </div>
        </div>
      )}

      {/* View C: Technical Audit List */}
      {activeTab === "audit" && (
        <div className="divide-y divide-border/60 text-xs sm:text-sm">
          {checks.map((check, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {check.status === "pass" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : check.status === "warn" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span className="font-medium text-foreground">{check.label}</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono text-right truncate max-w-[240px]">
                {check.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
