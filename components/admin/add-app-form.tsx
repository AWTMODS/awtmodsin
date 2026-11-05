"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppCategory, HostingProvider, Application } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Image as ImageIcon,
  HardDrive,
  Globe,
  Loader2,
  Eye,
  X,
  Sparkles,
  Monitor,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

interface AddAppFormProps {
  categories: AppCategory[];
  initialApp?: Application;
}

interface MirrorForm {
  hosting_provider: HostingProvider;
  download_url: string;
  mirror_name: string;
  is_primary: boolean;
}

export function AddAppForm({ categories, initialApp }: AddAppFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!initialApp?.id;

  // SECTION A: Basic Info
  const [platform, setPlatform] = useState<"android" | "pc">(
    (initialApp as any)?.platform || (initialApp?.category?.slug === "pc-software" ? "pc" : "android")
  );
  const [name, setName] = useState(initialApp?.name || "");
  const [slug, setSlug] = useState(initialApp?.slug || "");
  const [packageName, setPackageName] = useState(initialApp?.package_name || "");
  const [developer, setDeveloper] = useState(initialApp?.developer || "");
  const [categoryId, setCategoryId] = useState(
    initialApp?.category_id || categories[0]?.id || ""
  );
  const [shortDescription, setShortDescription] = useState(
    initialApp?.short_description || ""
  );
  const [description, setDescription] = useState(
    initialApp?.description || ""
  );

  const handlePlatformChange = (newPlatform: "android" | "pc") => {
    setPlatform(newPlatform);
    if (newPlatform === "pc") {
      const pcCat = categories.find((c) => c.slug === "pc-software");
      if (pcCat) {
        setCategoryId(pcCat.id);
      }
      if (!androidRequirement || androidRequirement === "Android 7.0+") {
        setAndroidRequirement("Windows 10 / 11 (64-bit)");
      }
      if (architecture === "arm64-v8a") {
        setArchitecture("x64 (64-bit)");
      }
    } else {
      if (androidRequirement === "Windows 10 / 11 (64-bit)") {
        setAndroidRequirement("Android 7.0+");
      }
      if (architecture === "x64 (64-bit)") {
        setArchitecture("arm64-v8a");
      }
    }
  };

  // Mod Features Unlocked
  const [modFeatures, setModFeatures] = useState<string[]>(
    initialApp?.mod_features && initialApp.mod_features.length > 0
      ? initialApp.mod_features
      : [
          "Premium Unlocked",
          "Ad-Free Clean Experience",
          "Verified Safe APK Build",
          "High Performance & Smooth",
        ]
  );
  const [newFeatureText, setNewFeatureText] = useState("");

  const addModFeature = (featText?: string) => {
    const text = (featText || newFeatureText).trim();
    if (!text) return;
    if (modFeatures.some((f) => f.toLowerCase() === text.toLowerCase())) {
      toast.error("This feature is already added");
      return;
    }
    setModFeatures((prev) => [...prev, text]);
    if (!featText) setNewFeatureText("");
  };

  const removeModFeature = (idx: number) => {
    setModFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  const suggestedFeatures =
    platform === "pc"
      ? [
          "Pre-Activated / Lifetime License",
          "Clean Repack & Ad-Free",
          "Standalone / Portable Edition",
          "Offline Installer Included",
          "All Plugins & Addons Unlocked",
          "64-bit High Performance",
          "Multi-Language Support",
          "No Registration Required",
        ]
      : [
          "Premium Unlocked",
          "Ad-Free Clean Experience",
          "Unlimited Money / Coins",
          "Immortal / God Mode",
          "All Skins & Items Unlocked",
          "Pro Filters & 4K Export",
          "No Watermark",
          "High Bitrate / Lossless Audio",
          "Unlimited Energy / Lives",
          "Offline Mode Enabled",
        ];

  // SECTION B: Images
  const [iconUrl, setIconUrl] = useState(initialApp?.icon_url || "");
  const [screenshots, setScreenshots] = useState<string[]>(
    initialApp?.screenshots?.map((s) => (typeof s === "string" ? s : s.image_url)) || []
  );
  const [newScreenshotUrl, setNewScreenshotUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const apkInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, folder: "icons" | "screenshots") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }
    return data.url as string;
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIcon(true);
    try {
      const url = await handleFileUpload(file, "icons");
      setIconUrl(url);
      toast.success("App icon uploaded to Cloudinary!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload icon to Cloudinary");
    } finally {
      setUploadingIcon(false);
      e.target.value = "";
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingScreenshot(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const url = await handleFileUpload(files[i], "screenshots");
        setScreenshots((prev) => [...prev, url]);
      }
      toast.success("Screenshots uploaded to Cloudinary!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload screenshots");
    } finally {
      setUploadingScreenshot(false);
      e.target.value = "";
    }
  };

  // SECTION C: APK Info
  const [versionName, setVersionName] = useState(
    initialApp?.latest_version?.version_name || "v1.0.0"
  );
  const [versionCode, setVersionCode] = useState(
    initialApp?.latest_version?.version_code?.toString() || "1"
  );
  const [fileSize, setFileSize] = useState(
    initialApp?.latest_version?.file_size || ""
  );
  const [architecture, setArchitecture] = useState(
    initialApp?.latest_version?.architecture || "arm64-v8a"
  );
  const [androidRequirement, setAndroidRequirement] = useState(
    initialApp?.android_requirement || "Android 7.0+"
  );
  const [sha256, setSha256] = useState(
    initialApp?.latest_version?.sha256 || ""
  );
  const [releaseNotes, setReleaseNotes] = useState(
    initialApp?.latest_version?.release_notes || ""
  );

  // SECTION D: Download Source (Direct Upload vs External Links)
  const [downloadMethod, setDownloadMethod] = useState<"external" | "upload">(
    "external"
  );
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [uploadedApkUrl, setUploadedApkUrl] = useState("");
  const [uploadedApkName, setUploadedApkName] = useState("");

  const handleApkFileSelected = async (file: File) => {
    if (!file) return;

    setUploadingApk(true);
    setApkProgress(10);

    const formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setFileSize(formattedSize);

    try {
      let finalPublicUrl = "";

      // 1. Try Direct Presigned Upload to Cloudflare R2
      try {
        const presignRes = await fetch("/api/admin/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/vnd.android.package-archive",
          }),
        });

        if (presignRes.ok) {
          const presignData = await presignRes.json();
          if (presignData.uploadUrl) {
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("PUT", presignData.uploadUrl, true);
              xhr.setRequestHeader(
                "Content-Type",
                file.type || "application/vnd.android.package-archive"
              );

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const percent = Math.round((event.loaded / event.total) * 90);
                  setApkProgress(Math.max(15, percent));
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  finalPublicUrl = presignData.publicUrl;
                  resolve();
                } else {
                  reject(new Error(`Direct R2 upload status ${xhr.status}`));
                }
              };

              xhr.onerror = () =>
                reject(new Error("Direct R2 upload CORS or network error"));

              xhr.send(file);
            });
          }
        }
      } catch (directErr) {
        console.warn("Direct R2 PUT failed, switching to server proxy upload:", directErr);
      }

      // 2. If direct PUT failed (e.g. CORS), upload through server-side R2 pipeline
      if (!finalPublicUrl) {
        setApkProgress(60);
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/admin/r2/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.publicUrl) {
          throw new Error(uploadData.error || "Failed to upload APK to Cloudflare R2");
        }

        finalPublicUrl = uploadData.publicUrl;
      }

      setApkProgress(100);
      setUploadedApkUrl(finalPublicUrl);
      setUploadedApkName(file.name);

      // Set primary mirror to the R2 URL
      setMirrors((prev) => [
        {
          hosting_provider: "cloudflare_r2",
          download_url: finalPublicUrl,
          mirror_name: "High-Speed Direct Mirror (Cloudflare R2)",
          is_primary: true,
        },
        ...prev.map((m) => ({ ...m, is_primary: false })),
      ]);

      toast.success(
        `APK stored in Cloudflare R2 successfully! (${formattedSize})`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload APK to Cloudflare R2");
    } finally {
      setUploadingApk(false);
    }
  };

  const handleApkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleApkFileSelected(file);
    }
    e.target.value = "";
  };

  const initialMirrors: MirrorForm[] =
    initialApp?.latest_version?.download_sources &&
    initialApp.latest_version.download_sources.length > 0
      ? initialApp.latest_version.download_sources.map((m) => ({
          hosting_provider: m.hosting_provider,
          download_url: m.download_url,
          mirror_name: m.mirror_name || "Primary Mirror",
          is_primary: m.is_primary,
        }))
      : [
          {
            hosting_provider: "mediafire",
            download_url: "",
            mirror_name: "Primary Mirror",
            is_primary: true,
          },
        ];

  const [mirrors, setMirrors] = useState<MirrorForm[]>(initialMirrors);

  // SECTION E: Publishing Options
  const [status, setStatus] = useState<"published" | "draft">(
    (initialApp?.status as "published" | "draft") || "published"
  );
  const [isFeatured, setIsFeatured] = useState(initialApp?.is_featured || false);
  const [isTrending, setIsTrending] = useState(initialApp?.is_trending || false);

  // Auto slug generation from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const addMirror = () => {
    setMirrors((prev) => [
      ...prev,
      {
        hosting_provider: "google_drive",
        download_url: "",
        mirror_name: `Mirror ${prev.length + 1}`,
        is_primary: false,
      },
    ]);
  };

  const removeMirror = (index: number) => {
    if (mirrors.length <= 1) {
      toast.error("At least one download mirror is required");
      return;
    }
    setMirrors((prev) => prev.filter((_, i) => i !== index));
  };

  const setPrimaryMirror = (index: number) => {
    setMirrors((prev) =>
      prev.map((m, i) => ({
        ...m,
        is_primary: i === index,
      }))
    );
  };

  const addScreenshot = () => {
    if (newScreenshotUrl.trim()) {
      setScreenshots((prev) => [...prev, newScreenshotUrl.trim()]);
      setNewScreenshotUrl("");
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (submitStatus: "published" | "draft") => {
    if (!name.trim()) {
      toast.error("Application name is required");
      return;
    }
    if (!packageName.trim()) {
      toast.error("Package name is required (e.g. com.example.app)");
      return;
    }
    if (!iconUrl.trim()) {
      toast.error("Application icon is required");
      return;
    }

    const finalShortDesc =
      shortDescription.trim() ||
      `${name.trim()} modded application for Android. Download verified APK.`;

    const finalDesc =
      description.trim() ||
      `${name.trim()} is an unlocked and optimized Android application offering full features, high speed, and verified APK safety.`;

    const finalFileSize = fileSize.trim() || "50 MB";
    const finalDeveloper = developer.trim() || "AWTMods Team";

    if (finalShortDesc.length < 3) {
      toast.error("Short description must be at least 3 characters");
      return;
    }
    if (finalDesc.length < 5) {
      toast.error("Full description must be at least 5 characters");
      return;
    }

    setSubmitting(true);

    const cleanFinalSlug = (slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
      .replace(/\.html$/i, "")
      .replace(/^-|-$/g, "");

    const payload = {
      name: name.trim(),
      slug: cleanFinalSlug,
      package_name: packageName.trim(),
      developer: finalDeveloper,
      category_id: categoryId,
      platform,
      short_description: finalShortDesc,
      description: finalDesc,
      icon_url: iconUrl.trim(),
      android_requirement: androidRequirement,
      is_featured: isFeatured,
      is_trending: isTrending,
      status: submitStatus,
      screenshots,
      mod_features: modFeatures,
      version: {
        version_name: versionName.trim() || "v1.0.0",
        version_code: parseInt(versionCode, 10) || 1,
        file_size: finalFileSize,
        architecture,
        android_requirement: androidRequirement,
        sha256: sha256.trim() || null,
        release_notes: releaseNotes.trim() || "Initial release with unlocked features.",
        is_latest: true,
        status: submitStatus,
        download_sources: mirrors.map((m) => ({
          download_type: downloadMethod,
          hosting_provider: m.hosting_provider,
          download_url: m.download_url.trim() || "https://www.mediafire.com",
          mirror_name: m.mirror_name,
          is_primary: m.is_primary,
        })),
      },
    };

    const targetUrl = isEditing ? `/api/admin/apps/${initialApp!.id}` : "/api/admin/apps";
    const targetMethod = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(targetUrl, {
        method: targetMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save app");
      }

      toast.success(
        isEditing
          ? "Application updated successfully!"
          : submitStatus === "published"
          ? "Application published successfully!"
          : "Saved as draft"
      );
      router.push("/admin/apps");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* SECTION A: Basic Info */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-border/70 pb-3">
          <h2 className="text-lg font-bold text-foreground">
            Section A — Platform & Basic Information
          </h2>
          <p className="text-xs text-muted-foreground">
            Target platform, core metadata, and naming for the listing.
          </p>
        </div>

        {/* Platform Selector Toggle */}
        <div className="space-y-1.5 pb-2">
          <label className="text-xs font-semibold uppercase text-foreground">
            Target Platform <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => handlePlatformChange("android")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                platform === "android"
                  ? "border-foreground bg-foreground text-background shadow-xs"
                  : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>Android APK</span>
            </button>

            <button
              type="button"
              onClick={() => handlePlatformChange("pc")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                platform === "pc"
                  ? "border-foreground bg-foreground text-background shadow-xs"
                  : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-4 w-4" />
              <span>PC / Windows</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              {platform === "pc" ? "Software Name" : "App Name"} <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={platform === "pc" ? "e.g. Adobe Photoshop 2024" : "e.g. Spotify Mod APK"}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Slug (URL Key) <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={platform === "pc" ? "e.g. adobe-photoshop" : "e.g. spotify-premium"}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\.html$/i, ""))}
              className="rounded-xl font-mono"
            />
            <p className="text-[11px] text-muted-foreground font-mono">
              Live link: /apps/{(slug || "app-name").replace(/\.html$/i, "")}.html
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              {platform === "pc" ? "Package / Executable ID" : "Package Name"} <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={platform === "pc" ? "e.g. Adobe.Photoshop.exe" : "e.g. com.spotify.music"}
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Developer Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Spotify AB"
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-foreground">
              Category <span className="text-destructive">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-foreground">
              Short Description (Card tagline) <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Unlimited skips, high bitrate audio, and ad-free streaming."
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-foreground">
              Full Description & Features <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={4}
              placeholder="Detailed explanation of unlocked features, improvements, and requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Mod Features Unlocked Builder */}
          <div className="space-y-3 sm:col-span-2 pt-4 border-t border-border/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-semibold uppercase text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Mod Features Unlocked (Shown on App Page)</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Customize the exact unlocked perks for this specific application
              </span>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Type a feature (e.g. God Mode, Unlimited Money, No Ads) and press Enter"
                value={newFeatureText}
                onChange={(e) => setNewFeatureText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addModFeature();
                  }
                }}
                className="rounded-xl flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addModFeature()}
                className="rounded-xl px-4 gap-1.5 shrink-0 font-semibold"
              >
                <Plus className="h-4 w-4" />
                <span>Add Feature</span>
              </Button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Quick Add:
              </span>
              {suggestedFeatures.map((feat) => {
                const alreadyAdded = modFeatures.some((f) => f.toLowerCase() === feat.toLowerCase());
                return (
                  <button
                    key={feat}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addModFeature(feat)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      alreadyAdded
                        ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                        : "border-border bg-secondary/50 hover:bg-secondary text-foreground hover:border-foreground/40"
                    }`}
                  >
                    + {feat}
                  </button>
                );
              })}
            </div>

            {/* Current Feature Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {modFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/40 text-xs font-medium text-foreground shadow-xs group"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                  <button
                    type="button"
                    onClick={() => removeModFeature(idx)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded-md transition-colors ml-0.5"
                    title="Remove feature"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {modFeatures.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No custom mod features added yet. Use the input above or click quick tags.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: Application Images */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-border/70 pb-3">
          <h2 className="text-lg font-bold text-foreground">
            Section B — Application Images & Visuals
          </h2>
          <p className="text-xs text-muted-foreground">
            App icon and screenshots (preview and URL management).
          </p>
        </div>

        {/* Icon */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-foreground">
              App Icon URL <span className="text-destructive">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              Paste URL or upload image file to Cloudinary
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted flex items-center justify-center">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt="Icon Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground m-auto" />
              )}
            </div>
            <Input
              placeholder="https://res.cloudinary.com/.../icon.png"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              className="rounded-xl flex-1 font-mono text-xs"
            />
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleIconUpload}
              disabled={uploadingIcon}
            />
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => iconInputRef.current?.click()}
              disabled={uploadingIcon}
              className="rounded-xl gap-2 shrink-0 text-xs"
            >
              {uploadingIcon ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{uploadingIcon ? "Uploading..." : "Upload Icon"}</span>
            </Button>
          </div>
        </div>

        {/* Screenshots */}
        <div className="space-y-3 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-foreground">
              Screenshots Gallery ({screenshots.length})
            </label>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleScreenshotUpload}
              disabled={uploadingScreenshot}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => screenshotInputRef.current?.click()}
              disabled={uploadingScreenshot}
              className="rounded-xl gap-2 shrink-0 text-xs h-8"
            >
              {uploadingScreenshot ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{uploadingScreenshot ? "Uploading..." : "Upload Screenshots"}</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {screenshots.map((s, index) => (
              <div
                key={index}
                className="relative h-28 w-16 overflow-hidden rounded-xl border border-border bg-muted group"
              >
                <img src={s} alt={`Preview ${index}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeScreenshot(index)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Input
              placeholder="Or paste screenshot image URL (https://...)"
              value={newScreenshotUrl}
              onChange={(e) => setNewScreenshotUrl(e.target.value)}
              className="rounded-xl text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addScreenshot}
              className="rounded-xl shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add URL</span>
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION C: APK Information */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-border/70 pb-3">
          <h2 className="text-lg font-bold text-foreground">
            Section C — APK Specifications
          </h2>
          <p className="text-xs text-muted-foreground">
            Version numbers, file sizes, architecture, and integrity signatures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Version Name
            </label>
            <Input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Version Code
            </label>
            <Input
              type="number"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              File Size <span className="text-muted-foreground font-normal">(optional, default: 50 MB)</span>
            </label>
            <Input
              placeholder="e.g. 72 MB"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Architecture
            </label>
            <Input
              placeholder={platform === "pc" ? "e.g. x64 (64-bit)" : "e.g. arm64-v8a"}
              value={architecture}
              onChange={(e) => setArchitecture(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              {platform === "pc" ? "OS Requirement" : "Android Requirement"}
            </label>
            <Input
              placeholder={platform === "pc" ? "e.g. Windows 10 / 11 (64-bit)" : "e.g. Android 7.0+"}
              value={androidRequirement}
              onChange={(e) => setAndroidRequirement(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-xs font-semibold uppercase text-foreground">
              SHA-256 Checksum (Optional)
            </label>
            <Input
              placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
              value={sha256}
              onChange={(e) => setSha256(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-xs font-semibold uppercase text-foreground">
              What&apos;s New / Release Notes
            </label>
            <Textarea
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* SECTION D: Download Source (External Mirrors + Direct APK) */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-border/70 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Section D — Download Sources & Multi-Mirrors
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure reliable external hosting links or direct storage.
            </p>
          </div>

          {/* Toggle between External Hosting vs Direct Upload */}
          <div className="flex items-center gap-1 p-1 bg-secondary rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setDownloadMethod("external")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                downloadMethod === "external"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              External Hosting
            </button>
            <button
              type="button"
              onClick={() => setDownloadMethod("upload")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                downloadMethod === "upload"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              Direct Storage (R2/S3)
            </button>
          </div>
        </div>

        {downloadMethod === "upload" ? (
          <div
            className="border-2 border-dashed border-border hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors rounded-2xl p-8 text-center bg-secondary/20 space-y-4"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleApkFileSelected(f);
            }}
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center text-foreground">
              {uploadingApk ? (
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              ) : uploadedApkUrl ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              ) : (
                <HardDrive className="h-7 w-7 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-foreground">
                {uploadedApkUrl
                  ? `${platform === "pc" ? "Software" : "APK"} Stored in Cloudflare R2`
                  : uploadingApk
                  ? `Uploading to Cloudflare R2... ${apkProgress}%`
                  : `Direct ${platform === "pc" ? "PC Software" : "APK"} Upload to Cloudflare R2`}
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {uploadedApkUrl
                  ? `${uploadedApkName} (${fileSize}) is uploaded and configured as your high-speed primary mirror.`
                  : `Select or drop a signed ${platform === "pc" ? ".exe, .msi, or .zip" : ".apk"} file to upload directly to your Cloudflare R2 bucket (up to 2GB).`}
              </p>
            </div>

            {uploadingApk && (
              <div className="max-w-xs mx-auto space-y-1.5">
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border">
                  <div
                    className="bg-foreground h-full transition-all duration-200 rounded-full"
                    style={{ width: `${apkProgress}%` }}
                  />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground text-right">
                  {apkProgress}%
                </div>
              </div>
            )}

            {/* Hidden native file input controlled via apkInputRef */}
            <input
              ref={apkInputRef}
              type="file"
              accept=".apk,.APK,.exe,.EXE,.msi,.MSI,.zip,.ZIP,.rar,.RAR,.7z,.7Z,application/*"
              className="hidden"
              onChange={handleApkUpload}
              disabled={uploadingApk}
            />

            {uploadedApkUrl ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="text-xs font-mono bg-card px-3 py-1.5 rounded-xl border border-border text-muted-foreground break-all max-w-md">
                  {uploadedApkUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => apkInputRef.current?.click()}
                  disabled={uploadingApk}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Replace File</span>
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => apkInputRef.current?.click()}
                  disabled={uploadingApk}
                  className="rounded-xl gap-2 font-bold text-sm px-6 h-12 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  {uploadingApk ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading ({apkProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>{platform === "pc" ? "Choose Software File (.exe, .zip)" : "Choose .APK File"}</span>
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Or drag &amp; drop your installer file directly into this area
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {mirrors.map((mirror, index) => (
              <div
                key={index}
                className="p-4 rounded-2xl border border-border bg-secondary/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      Mirror #{index + 1}
                    </span>
                    {mirror.is_primary ? (
                      <Badge variant="success" className="text-[10px]">
                        Primary Mirror
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimaryMirror(index)}
                        className="text-[11px] text-muted-foreground underline hover:text-foreground"
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {mirror.download_url && (
                      <a
                        href={mirror.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Test Link</span>
                      </a>
                    )}
                    {mirrors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMirror(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Provider
                    </label>
                    <select
                      value={mirror.hosting_provider}
                      onChange={(e) => {
                        const val = e.target.value as HostingProvider;
                        setMirrors((prev) =>
                          prev.map((m, i) =>
                            i === index ? { ...m, hosting_provider: val } : m
                          )
                        );
                      }}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="mediafire">MediaFire</option>
                      <option value="google_drive">Google Drive</option>
                      <option value="dropbox">Dropbox</option>
                      <option value="mega">MEGA</option>
                      <option value="telegram">Telegram</option>
                      <option value="custom">Custom URL</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Mirror Label
                    </label>
                    <Input
                      value={mirror.mirror_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMirrors((prev) =>
                          prev.map((m, i) =>
                            i === index ? { ...m, mirror_name: val } : m
                          )
                        );
                      }}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Destination Download URL
                    </label>
                    <Input
                      placeholder="https://..."
                      value={mirror.download_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMirrors((prev) =>
                          prev.map((m, i) =>
                            i === index ? { ...m, download_url: val } : m
                          )
                        );
                      }}
                      className="rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMirror}
              className="rounded-xl gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Add Another Download Mirror</span>
            </Button>
          </div>
        )}
      </div>

      {/* SECTION E: Publishing Options */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-border/70 pb-3">
          <h2 className="text-lg font-bold text-foreground">
            Section E — Publishing & Promotion
          </h2>
          <p className="text-xs text-muted-foreground">
            Feature flags, trending status, and final publishing actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>Mark as Featured Application</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isTrending}
              onChange={(e) => setIsTrending(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>Mark as Trending Application</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={submitting}
            onClick={() => handleSubmit("draft")}
            className="w-full sm:w-auto rounded-xl px-6 font-semibold"
          >
            {isEditing ? "Update as Draft" : "Save as Draft"}
          </Button>

          <Button
            type="button"
            size="lg"
            disabled={submitting}
            onClick={() => handleSubmit("published")}
            className="w-full sm:w-auto rounded-xl px-8 font-bold gap-2 shadow-md"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isEditing ? "Updating..." : "Publishing..."}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isEditing ? "Save & Update Application" : "Publish Application"}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

