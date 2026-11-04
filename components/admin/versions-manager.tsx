"use client";

import { useState } from "react";
import { Application, ApplicationVersion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Plus, Check, Trash2, GitBranch, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function VersionsManager({
  initialApps,
}: {
  initialApps: Application[];
}) {
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [selectedAppId, setSelectedAppId] = useState<string>(
    initialApps[0]?.id || ""
  );

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const versions = selectedApp?.versions || [];

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

  const handleSetLatest = (versionId: string) => {
    if (!selectedApp) return;
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
    toast.success("Set as latest active version");
  };

  return (
    <div className="space-y-6">
      {/* App Selector */}
      <div className="p-5 rounded-3xl border border-border bg-card shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
            Select Application to Manage
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground focus:outline-none"
          >
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.latest_version?.version_name || "v1.0"})
              </option>
            ))}
          </select>
        </div>

        {selectedApp && (
          <div className="text-xs text-muted-foreground">
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
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
            Version Releases for {selectedApp?.name}
          </h3>

          <div className="divide-y divide-border/60">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground font-mono">
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
                  <div className="text-xs text-muted-foreground">
                    Released: {formatDate(ver.created_at)} • Arch: {ver.architecture}
                  </div>
                  {ver.release_notes && (
                    <div className="text-xs text-muted-foreground whitespace-pre-line pt-1">
                      {ver.release_notes}
                    </div>
                  )}
                </div>

                {!ver.is_latest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetLatest(ver.id)}
                    className="text-xs rounded-xl"
                  >
                    Mark as Latest
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

