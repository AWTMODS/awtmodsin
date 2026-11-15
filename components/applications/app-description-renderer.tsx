import React from "react";
import { CheckCircle2, Sparkles, ChevronRight, Zap } from "lucide-react";

interface AppDescriptionRendererProps {
  content: string;
  appName?: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Parses inline markdown: **bold**, *italic*, and regular text
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const decoded = decodeHtmlEntities(text);
  // Match **bold** or *italic*
  const parts = decoded.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function AppDescriptionRenderer({
  content,
  appName,
}: AppDescriptionRendererProps) {
  if (!content || !content.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No description provided for this application.
      </p>
    );
  }

  // Pre-process: normalize line endings, strip any stray "fist paragraph of ..." artifacts, and split by horizontal rules (---)
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/^\s*f(?:i|ir)st paragraph of[^\n]*(\n+|$)/im, "");
  const rawSections = normalized.split(/\n\s*---\s*\n/g);

  return (
    <div className="space-y-6 text-sm sm:text-base leading-relaxed text-muted-foreground break-words min-w-0">
      {rawSections.map((section, sIdx) => {
        const lines = section.split("\n");
        const elements: React.ReactNode[] = [];
        let currentList: string[] = [];

        const flushList = (listKey: string) => {
          if (currentList.length === 0) return;
          const items = [...currentList];
          currentList = [];

          const isModFeatureList = items.some(
            (i) =>
              i.toLowerCase().includes("unlocked") ||
              i.toLowerCase().includes("ad-free") ||
              i.toLowerCase().includes("premium")
          );

          elements.push(
            <div
              key={listKey}
              className={`my-3.5 grid grid-cols-1 ${
                items.length > 2 ? "sm:grid-cols-2" : "grid-cols-1"
              } gap-2.5 p-3.5 sm:p-4 rounded-2xl border ${
                isModFeatureList
                  ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                  : "border-border/80 bg-secondary/30"
              }`}
            >
              {items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      isModFeatureList ? "text-emerald-500" : "text-primary"
                    }`}
                  />
                  <div className="text-xs sm:text-sm text-foreground/90 leading-snug break-words">
                    {renderInlineMarkdown(item)}
                  </div>
                </div>
              ))}
            </div>
          );
        };

        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();

          // Empty line or stray scraper artifact
          if (!trimmed || /^f(?:i|ir)st paragraph of/i.test(trimmed)) {
            flushList(`list-${sIdx}-${lineIdx}`);
            return;
          }

          // Horizontal rule fallback
          if (trimmed === "---" || trimmed === "***") {
            flushList(`list-${sIdx}-${lineIdx}`);
            elements.push(<hr key={`hr-${sIdx}-${lineIdx}`} className="my-5 border-border/60" />);
            return;
          }

          // Bullet item (- or * or •)
          if (/^[-*•]\s+/.test(trimmed)) {
            const bulletText = trimmed.replace(/^[-*•]\s+/, "");
            currentList.push(bulletText);
            return;
          }

          // Heading 3: ### Heading
          if (trimmed.startsWith("###")) {
            flushList(`list-${sIdx}-${lineIdx}`);
            const headingText = trimmed.replace(/^###\s*/, "");
            elements.push(
              <div
                key={`h3-${sIdx}-${lineIdx}`}
                className="pt-3 pb-1 flex items-center gap-2 text-base sm:text-lg font-bold text-foreground border-b border-border/40"
              >
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="break-words">{renderInlineMarkdown(headingText)}</span>
              </div>
            );
            return;
          }

          // Heading 2 or 1: ## or #
          if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
            flushList(`list-${sIdx}-${lineIdx}`);
            const headingText = trimmed.replace(/^#+\s*/, "");
            elements.push(
              <h3
                key={`h2-${sIdx}-${lineIdx}`}
                className="pt-4 pb-1 text-base sm:text-lg font-extrabold text-foreground tracking-tight break-words"
              >
                {renderInlineMarkdown(headingText)}
              </h3>
            );
            return;
          }

          // Regular paragraph
          flushList(`list-${sIdx}-${lineIdx}`);
          elements.push(
            <p
              key={`p-${sIdx}-${lineIdx}`}
              className="text-muted-foreground my-2 leading-relaxed break-words"
            >
              {renderInlineMarkdown(trimmed)}
            </p>
          );
        });

        // Flush any remaining list items in the section
        flushList(`list-${sIdx}-end`);

        return (
          <div key={sIdx} className="space-y-2">
            {elements}
            {sIdx < rawSections.length - 1 && (
              <hr className="my-6 border-border/60" />
            )}
          </div>
        );
      })}
    </div>
  );
}
