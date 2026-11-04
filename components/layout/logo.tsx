import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 36 : 28;

  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 font-bold tracking-tight text-foreground group select-none",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Minimal Black & White Geometric Logo Symbol */}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:scale-105"
        >
          <path
            d="M16 2L3 28H10.5L16 16.5L21.5 28H29L16 2Z"
            fill="currentColor"
            className="text-foreground"
          />
          <polygon
            points="16,8 9,23 23,23"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-background"
          />
        </svg>
      </div>

      {showText && (
        <span
          className={cn("tracking-tight font-extrabold", {
            "text-base": size === "sm",
            "text-xl": size === "md",
            "text-2xl": size === "lg",
          })}
        >
          AWT<span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">Mods</span>
        </span>
      )}
    </Link>
  );
}

