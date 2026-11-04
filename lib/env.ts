import fs from "fs";
import path from "path";

/**
 * Gets an environment variable from process.env, with automatic on-demand
 * disk fallback to .env.local if the dev server was started before .env.local was created.
 */
export function getEnv(key: string, defaultValue = ""): string {
  if (process.env[key]) {
    return process.env[key]!;
  }

  try {
    const envLocalPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const k = trimmed.substring(0, eqIdx).trim();
            const v = trimmed.substring(eqIdx + 1).trim();
            if (k === key) {
              process.env[key] = v; // cache in process.env
              return v;
            }
          }
        }
      }
    }
  } catch {
    // Ignore file read errors
  }

  return defaultValue;
}

