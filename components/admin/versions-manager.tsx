"use client";

import { useState } from "react";
import { Application, ApplicationVersion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Plus, Check, Trash2, GitBranch, ExternalLink, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuickReleaseCard } from "./quick-release-card";
import { ApkInspector, ApkInspectionData } from "./apk-inspector";

export function VersionsManager({
  initialApps,
}: {
  initialApps: Application[];
}) {
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [selectedAppId, setSelectedAppId] = useState<string>(
    initialApps[0]?.id || ""
  );
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const versions = selectedApp?.versions || [];

  const handleUpdateSuccess = (updatedApp: Application) => {
    setApps((prev) =>
      prev.map((a) => (a.id === updatedApp.id ? updatedApp : a))
    );
    setSelectedAppId(updatedApp.id);
  };

  if (apps.length === 0) {
    return (
      <div className="py-16 text-center rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
        <GitBranch className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-base font-bold text-foreground">
          No applications published yet
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Please publish an application first to manage releases and versions.
        </p>
        <a href="/admin/apps/new">
          <Button size="sm" className="rounded-xl mt-2 font-semibold">
            Add New App
          </Button>
        </a>
      </div>
    );
  }

  // New version form state
  const [newVersionName, setNewVersionName] = useState("");
  const [newVersionCode, setNewVersionCode] = useState("2");
  const [newFileSize, setNewFileSize] = useState("75 MB");
  const [newReleaseNotes, setNewReleaseNotes] = useState("");
  const [newUrl, setNewUrl] = useState("https://www.mediafire.com");

  const handleAddVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim() || !selectedApp) return;

    const newVer: ApplicationVersion = {
      id: `ver-${Date.now()}`,
      application_id: selectedApp.id,
      version_name: newVersionName.trim(),
      version_code: parseInt(newVersionCode, 10) || 1,
      file_size: newFileSize.trim(),
      architecture: "arm64-v8a",
      android_requirement: selectedApp.android_requirement || "Android 7.0+",
      release_notes: newReleaseNotes.trim(),
      is_latest: true,
      status: "published",
      created_at: new Date().toISOString(),
      download_sources: [
        {
          id: `src-${Date.now()}`,
          version_id: `ver-${Date.now()}`,
          download_type: "external",
          hosting_provider: "mediafire",
          download_url: newUrl || "https://www.mediafire.com",
          mirror_name: "MediaFire Fast Mirror",
          is_primary: true,
          is_active: true,
        },
      ],
    };

    setApps((prev) =>
      prev.map((a) => {
        if (a.id === selectedApp.id) {
          const updatedVersions = [
            newVer,
            ...(a.versions || []).map((v) => ({ ...v, is_latest: false })),
          ];
          return {
            ...a,
            latest_version: newVer,
            versions: updatedVersions,
            updated_at: new Date().toISOString(),
          };
        }
        return a;
      })
    );

    setNewVersionName("");
    setNewReleaseNotes("");
    toast.success(`Published ${newVersionName} for ${selectedApp.name}!`);
  };

  const handleSetLatest = async (versionId: string) => {
    if (!selectedApp) return;
    setRollingBackId(versionId);

    try {
      const res = await fetch("/api/admin/versions/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedApp.id,
          versionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set version as active");
      }

      if (data.app) {
        handleUpdateSuccess(data.app);
      } else {
        // Fallback local update
        setApps((prev) =>
          prev.map((a) => {
            if (a.id === selectedApp.id) {
              const target = a.versions?.find((v) => v.id === versionId);
              const updated = (a.versions || []).map((v) => ({
                ...v,
                is_latest: v.id === versionId,
              }));
              return {
                ...a,
                latest_version: target || a.latest_version,
                versions: updated,
              };
            }
            return a;
          })
        );
      }

      toast.success("Successfully set version as active primary release!");
    } catch (err: any) {
      toast.error(err.message || "Failed to rollback version");
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Smart Quick-Release Multi-Mirror Engine */}
      <QuickReleaseCard
        allApps={apps}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* App Selector */}
      <div className="p-4 sm:p-5 rounded-3xl border border-border bg-card shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden w-full min-w-0">
        <div className="w-full sm:w-auto min-w-0 flex-1 max-w-full overflow-hidden">
          <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
            Select Application to Manage
          </label>
          <div className="relative w-full min-w-0 max-w-full overflow-hidden">
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full min-w-0 max-w-full sm:max-w-md truncate rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground focus:outline-none cursor-pointer block box-border"
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.latest_version?.version_name || "v1.0"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedApp && (
          <div className="text-xs text-muted-foreground shrink-0 break-words">
            Current version:{" "}
            <span className="font-mono font-bold text-foreground">
              {selectedApp.latest_version?.version_name}
            </span>{" "}
            • Total versions: {versions.length}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Existing Versions History */}
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4 overflow-hidden min-w-0 w-full">
          <h3 className="font-bold text-base text-foreground pb-2 border-b border-border break-words">
            Version Releases for {selectedApp?.name}
          </h3>

          <div className="divide-y divide-border/60">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 min-w-0 overflow-hidden"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground font-mono break-all">
                      {ver.version_name}
                    </span>
                    {ver.is_latest && (
                      <Badge variant="success" className="text-[10px]">
                        Latest Active
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ver.file_size}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground break-words">
                    Released: {formatDate(ver.created_at)} • Arch: {ver.architecture}
                  </div>
                  {ver.release_notes && (
                    <div className="text-xs text-muted-foreground whitespace-pre-line pt-1 break-words">
                      {ver.release_notes}
                    </div>
                  )}
                </div>

                {!ver.is_latest && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rollingBackId === ver.id}
                    onClick={() => handleSetLatest(ver.id)}
                    className="text-xs rounded-xl shrink-0 self-start sm:self-auto gap-1.5 border-border hover:border-amber-500/50 hover:bg-amber-500/10 text-foreground"
                    title="Rollback or set this version as the primary active release"
                  >
                    {rollingBackId === ver.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Rolling Back...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                        <span>Rollback to this Build</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add New Version Release Form */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4 h-fit">
          <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
            Publish New Version
          </h3>

          {/* Instant APK Binary Inspector */}
          <ApkInspector
            onParsed={(data) => {
              if (data.versionName) setNewVersionName(data.versionName);
              if (data.versionCode) setNewVersionCode(String(data.versionCode));
              if (data.fileSize) setNewFileSize(data.fileSize);
            }}
          />

          <form onSubmit={handleAddVersion} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Version Name
              </label>
              <Input
                placeholder="e.g. v9.1.0"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                required
                className="rounded-xl text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Version Code
                </label>
                <Input
                  type="number"
                  value={newVersionCode}
                  onChange={(e) => setNewVersionCode(e.target.value)}
                  className="rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  File Size
                </label>
                <Input
                  value={newFileSize}
                  onChange={(e) => setNewFileSize(e.target.value)}
                  className="rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Download URL (MediaFire / External)
              </label>
              <Input
                placeholder="https://www.mediafire.com/file/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Changelog / Release Notes
              </label>
              <Textarea
                rows={3}
                placeholder="• Bug fixes and speed improvements..."
                value={newReleaseNotes}
                onChange={(e) => setNewReleaseNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <Button
              type="submit"
              size="default"
              className="w-full rounded-xl font-bold gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Publish Version</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

