import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-24 sm:py-32 text-center">
      <div className="mx-auto w-16 h-16 rounded-3xl bg-secondary border border-border flex items-center justify-center text-foreground mb-6">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mb-3">
        404 — Page Not Found
      </h1>
      <p className="text-base text-muted-foreground max-w-md mx-auto mb-8">
        The application, page, or resource you are looking for does not exist or has been moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button variant="default" className="rounded-xl gap-2 font-medium">
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
        <Link href="/apps">
          <Button variant="outline" className="rounded-xl gap-2 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Browse Apps
          </Button>
        </Link>
      </div>
    </div>
  );
}
