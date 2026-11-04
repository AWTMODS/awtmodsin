"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans antialiased min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl border border-neutral-800 bg-neutral-900">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-white">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold">System Error</h2>
          <p className="text-sm text-neutral-400">
            A critical error occurred. Please refresh or try again shortly.
          </p>
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
