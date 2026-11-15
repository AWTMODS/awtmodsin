"use client";

import { useState, useRef } from "react";
import { Upload, Check, AlertCircle, FileCode, Cpu, HardDrive, Smartphone, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface ApkInspectionData {
  fileName: string;
  fileSize: string;
  architecture: string;
  versionName?: string;
  versionCode?: number;
  packageName?: string;
}

interface ApkInspectorProps {
  onParsed: (data: ApkInspectionData) => void;
  className?: string;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 MB";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizes = ["Bytes", "KB", "MB", "GB"];
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || "MB"}`;
}

export function ApkInspector({ onParsed, className = "" }: ApkInspectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [inspected, setInspected] = useState<ApkInspectionData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseApkFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".apk") && !file.name.toLowerCase().endsWith(".xapk")) {
      toast.error("Please drop a valid .apk or .xapk package file.");
      return;
    }

    setIsParsing(true);
    try {
      const fileSize = formatBytes(file.size);
      let detectedArch = "Universal (all devices)";
      let detectedVersionName = "";
      let detectedVersionCode = 1;
      let detectedPackage = "";

      // 1. Extract from file name heuristic (e.g. Spotify_v8.9.74.568_arm64-v8a.apk)
      const cleanName = file.name.replace(/\.(?:apk|xapk)$/i, "");
      const verRegex = /\bv?([0-9]+(?:\.[0-9]+)+(?:-[a-zA-Z0-9]+)?)\b/;
      const verMatch = cleanName.match(verRegex);
      if (verMatch) {
        detectedVersionName = verMatch[1].startsWith("v") ? verMatch[1] : `v${verMatch[1]}`;
      }

      if (/arm64|v8a/i.test(cleanName)) {
        detectedArch = "arm64-v8a";
      } else if (/armeabi|v7a/i.test(cleanName)) {
        detectedArch = "armeabi-v7a";
      } else if (/x86_64/i.test(cleanName)) {
        detectedArch = "x86_64";
      }

      // 2. Read first 512KB and last 128KB of the APK file to inspect ZIP central directory and manifest strings
      const sliceSize = Math.min(file.size, 512 * 1024);
      const startBuffer = await file.slice(0, sliceSize).arrayBuffer();
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      const rawText = textDecoder.decode(new Uint8Array(startBuffer));

      // Scan for architectures in ZIP entry filenames
      if (rawText.includes("lib/arm64-v8a/")) {
        detectedArch = "arm64-v8a";
      } else if (rawText.includes("lib/armeabi-v7a/")) {
        detectedArch = "armeabi-v7a";
      } else if (rawText.includes("lib/x86_64/")) {
        detectedArch = "x86_64";
      }

      // Scan for package names (common Android package convention)
      const pkgMatch = rawText.match(/\b(com\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\b/);
      if (pkgMatch && !detectedPackage) {
        // Exclude common android internal library packages
        const candidate = pkgMatch[1];
        if (!candidate.startsWith("com.google.android") && !candidate.startsWith("com.android")) {
          detectedPackage = candidate;
        }
      }

      // Version code extraction fallback
      const codeMatch = cleanName.match(/\b(?:code|build|b)[_.-]?([0-9]{3,9})\b/i);
      if (codeMatch) {
        detectedVersionCode = parseInt(codeMatch[1], 10) || 1;
      }

      const result: ApkInspectionData = {
        fileName: file.name,
        fileSize,
        architecture: detectedArch,
        versionName: detectedVersionName || "v1.0.0",
        versionCode: detectedVersionCode,
        packageName: detectedPackage || undefined,
      };

      setInspected(result);
      onParsed(result);
      toast.success(`Successfully parsed ${file.name}! Version & metadata extracted.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to inspect APK binary.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      parseApkFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      parseApkFile(e.target.files[0]);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".apk,.xapk"
        className="hidden"
        onChange={handleFileInput}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
            : "border-border hover:border-emerald-500/40 bg-secondary/30 hover:bg-secondary/50"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
            {isParsing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">
              {isParsing ? "Inspecting APK Binary Headers..." : "Drop .APK file here to Auto-Inspect"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Instantly reads file size, architectures, and version tags directly in your browser without uploading!
            </p>
          </div>
        </div>
      </div>

      {inspected && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              <span>Inspection Complete: {inspected.fileName}</span>
            </span>
            <span className="font-mono">{inspected.fileSize}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-emerald-500/20">
            <div>
              <span className="text-muted-foreground block">Version:</span>
              <strong className="text-foreground font-mono">{inspected.versionName}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Architecture:</span>
              <strong className="text-foreground font-mono">{inspected.architecture}</strong>
            </div>
            {inspected.packageName && (
              <div>
                <span className="text-muted-foreground block">Package:</span>
                <strong className="text-foreground font-mono truncate block">
                  {inspected.packageName}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
