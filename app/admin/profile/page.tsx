import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, ShieldCheck, Key, Lock } from "lucide-react";

export const metadata = {
  title: "Admin Profile | AWTMods Admin",
};

export default function AdminProfilePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Admin Profile & Security
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage your administrator account and security credentials.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card space-y-6 shadow-xs">
        <div className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="h-16 w-16 rounded-2xl bg-secondary border border-border flex items-center justify-center font-bold text-xl text-foreground">
            A
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Super Administrator
              </h2>
              <Badge variant="success" className="text-[10px]">
                Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Primary System Operator • Full Access Rights
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Admin Email
            </label>
            <Input
              value="admin@awtmods.in"
              readOnly
              className="rounded-xl font-mono text-xs bg-muted/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-foreground">
              Role
            </label>
            <Input
              value="Superadministrator (RLS Bypass / Owner)"
              readOnly
              className="rounded-xl text-xs bg-muted/30"
            />
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span>Change Security Password</span>
            </h3>

            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Current password"
                className="rounded-xl text-xs"
              />
              <Input
                type="password"
                placeholder="New strong password"
                className="rounded-xl text-xs"
              />
              <Button size="sm" className="rounded-xl font-semibold">
                Update Password
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

