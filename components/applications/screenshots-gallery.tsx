"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";
import { AppScreenshot } from "@/lib/types";

interface ScreenshotsGalleryProps {
  screenshots: AppScreenshot[];
  appName: string;
}

export function ScreenshotsGallery({
  screenshots,
  appName,
}: ScreenshotsGalleryProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  return (
    <>
      {/* Horizontal scrolling gallery */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin">
        {screenshots.map((s, index) => (
          <div
            key={s.id || index}
            onClick={() => setActiveImage(s.image_url)}
            className="group relative h-80 w-44 sm:h-96 sm:w-52 shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-border bg-card shadow-sm snap-start transition-all duration-300 hover:scale-[1.02] hover:border-neutral-400"
          >
            <Image
              src={s.image_url}
              alt={`${appName} screenshot ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 176px, 208px"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <ZoomIn className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl border border-border/40 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={activeImage}
              alt="Screenshot full preview"
              className="max-h-[85vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

