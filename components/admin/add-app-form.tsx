"use client";

import { useState } from "react";
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

  // SECTION B: Images
  const [iconUrl, setIconUrl] = useState(initialApp?.icon_url || "");
  const [screenshots, setScreenshots] = useState<string[]>(
    initialApp?.screenshots?.map((s) => (typeof s === "string" ? s : s.image_url)) || []
  );
  const [newScreenshotUrl, setNewScreenshotUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

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

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingApk(true);
    setApkProgress(0);

    try {
      // 1. Get presigned upload URL from Cloudflare R2
      const presignRes = await fetch("/api/admin/r2/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/vnd.android.package-archive",
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || "Failed to initialize Cloudflare R2 storage");
      }

      // 2. Direct streaming upload to Cloudflare R2 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignData.uploadUrl, true);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/vnd.android.package-archive"
        );

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setApkProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Cloudflare R2 rejected upload (${xhr.status})`));
          }
        };

        xhr.onerror = () =>
          reject(new Error("Network error during APK upload to Cloudflare R2"));

        xhr.send(file);
      });

      const formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setFileSize(formattedSize);
      setUploadedApkUrl(presignData.publicUrl);
      setUploadedApkName(file.name);

      // Set primary mirror to the R2 URL
      setMirrors((prev) => [
        {
          hosting_provider: "cloudflare_r2",
          download_url: presignData.publicUrl,
          mirror_name: "High-Speed Direct Mirror (Cloudflare R2)",
          is_primary: true,
        },
        ...prev.map((m) => ({ ...m, is_primary: false })),
      ]);

      toast.success(
        `APK uploaded to Cloudflare R2 successfully! (${formattedSize})`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload APK to Cloudflare R2");
    } finally {
      setUploadingApk(false);
    }
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

    const payload = {
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      package_name: packageName.trim(),
      developer: finalDeveloper,
      category_id: categoryId,
      short_description: finalShortDesc,
      description: finalDesc,
      icon_url: iconUrl.trim(),
      android_requirement: androidRequirement,
      is_featured: isFeatured,
      is_trending: isTrending,
      status: submitStatus,
      screenshots,
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
            Section A — Basic Information
          </h2>
          <p className="text-xs text-muted-foreground">
            Core metadata and naming for the application listing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              App Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Spotify Mod APK"
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
              placeholder="e.g. spotify-mod-apk"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Package Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. com.spotify.music"
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
            <label className="cursor-pointer">
              <input
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
                disabled={uploadingIcon}
                className="rounded-xl gap-2 shrink-0 pointer-events-none"
              >
                {uploadingIcon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{uploadingIcon ? "Uploading..." : "Upload Icon"}</span>
              </Button>
            </label>
          </div>
        </div>

        {/* Screenshots */}
        <div className="space-y-3 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-foreground">
              Screenshots Gallery ({screenshots.length})
            </label>
            <label className="cursor-pointer">
              <input
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
                disabled={uploadingScreenshot}
                className="rounded-xl gap-2 shrink-0 pointer-events-none text-xs h-8"
              >
                {uploadingScreenshot ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{uploadingScreenshot ? "Uploading..." : "Upload Screenshots"}</span>
              </Button>
            </label>
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
              value={architecture}
              onChange={(e) => setArchitecture(e.target.value)}
              className="rounded-xl font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Android Requirement
            </label>
            <Input
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
          <div className="border border-dashed border-border rounded-2xl p-8 text-center bg-secondary/20 space-y-4">
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
                  ? "APK Stored in Cloudflare R2"
                  : uploadingApk
                  ? `Uploading to Cloudflare R2... ${apkProgress}%`
                  : "Direct APK Upload to Cloudflare R2"}
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {uploadedApkUrl
                  ? `${uploadedApkName} (${fileSize}) is uploaded and configured as your high-speed primary mirror.`
                  : "Select or drop a signed .apk file to upload directly to your Cloudflare R2 bucket (up to 2GB)."}
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

            {uploadedApkUrl ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="text-xs font-mono bg-card px-3 py-1.5 rounded-xl border border-border text-muted-foreground break-all max-w-md">
                  {uploadedApkUrl}
                </div>
                <label className="cursor-pointer pt-1">
                  <input
                    type="file"
                    accept=".apk"
                    className="hidden"
                    onChange={handleApkUpload}
                    disabled={uploadingApk}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1.5 pointer-events-none"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Replace APK</span>
                  </Button>
                </label>
              </div>
            ) : (
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept=".apk"
                  className="hidden"
                  onChange={handleApkUpload}
                  disabled={uploadingApk}
                />
                <Button
                  type="button"
                  variant="default"
                  disabled={uploadingApk}
                  className="rounded-xl gap-2 font-semibold text-xs pointer-events-none px-5"
                >
                  {uploadingApk ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading ({apkProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Choose .APK File</span>
                    </>
                  )}
                </Button>
              </label>
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

