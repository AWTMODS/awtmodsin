import { z } from "zod";

export const downloadSourceSchema = z.object({
  id: z.string().optional(),
  download_type: z.enum(["upload", "external"]),
  hosting_provider: z.enum([
    "mediafire",
    "google_drive",
    "dropbox",
    "mega",
    "telegram",
    "custom",
    "cloudflare_r2",
    "supabase_storage",
  ]),
  download_url: z.string().url("Must be a valid URL"),
  mirror_name: z.string().optional().nullable(),
  is_primary: z.boolean().default(false),
});

export const versionSchema = z.object({
  id: z.string().optional(),
  version_name: z.string().min(1, "Version name is required (e.g. v9.0.26.4)"),
  version_code: z.coerce.number().min(1).default(1),
  file_size: z.string().min(1, "File size is required (e.g. 72 MB)").default("Varies with device"),
  architecture: z.string().default("arm64-v8a"),
  android_requirement: z.string().default("Android 7.0+"),
  sha256: z.string().optional().nullable(),
  release_notes: z.string().optional().nullable(),
  is_latest: z.boolean().default(true),
  status: z.enum(["published", "draft", "disabled"]).default("published"),
  download_sources: z.array(downloadSourceSchema).min(1, "At least one download mirror is required"),
});

export const applicationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "App name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
  package_name: z.string().min(3, "Package name is required (e.g. com.spotify.music)"),
  developer: z.string().min(1, "Developer name is required"),
  category_id: z.string().min(1, "Please select a category"),
  short_description: z.string().min(3, "Short description must be at least 3 characters"),
  description: z.string().min(5, "Full description must be at least 5 characters"),
  icon_url: z.string().url("Must be a valid icon URL"),
  banner_url: z.string().url().optional().nullable().or(z.literal("")),
  android_requirement: z.string().default("Android 7.0+"),
  is_featured: z.boolean().default(false),
  is_trending: z.boolean().default(false),
  status: z.enum(["published", "draft", "archived"]).default("published"),
  screenshots: z.array(z.string().url()).optional().default([]),
  version: versionSchema.optional(),
});

export const reportSchema = z.object({
  application_id: z.string().optional().nullable(),
  report_type: z.enum([
    "broken_link",
    "incorrect_info",
    "outdated_version",
    "dmca",
    "security",
    "other",
  ]),
  email: z.string().email("Please provide a valid email").optional().or(z.literal("")),
  message: z.string().min(10, "Please describe the issue in detail (at least 10 characters)"),
});

export const siteSettingsSchema = z.object({
  siteName: z.string().min(1),
  tagline: z.string(),
  siteDescription: z.string(),
  siteUrl: z.string().url(),
  logoText: z.string(),
  contactEmail: z.string().email(),
  defaultTheme: z.enum(["light", "dark", "system"]),
  telegramUrl: z.string().url(),
  instagramUrl: z.string().url(),
  youtubeUrl: z.string().url(),
  twitterUrl: z.string().url(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  ogImage: z.string(),
  countdownSeconds: z.coerce.number().min(1).max(30),
  allowDirectUploads: z.boolean(),
  enableChecksumVerification: z.boolean(),
  allowedProviders: z.array(z.string()),
});

