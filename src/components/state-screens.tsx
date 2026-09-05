import { useState } from "react";
import {
  CircleAlert,
  Ghost,
  LoaderCircle,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, beginDiscordSignIn } from "@/lib/board-api";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-card" />
      <div className="mx-auto max-w-7xl space-y-8 p-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((column) => (
            <div key={column} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-36" />
              <Skeleton className="h-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorScreen({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const unauthorized = error instanceof ApiError && error.status === 401;
  const localSetup =
    error instanceof ApiError && error.code === "local_config_missing";
  const [signingIn, setSigningIn] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-[#29231f] text-[#f5a36f]">
          {unauthorized ? <Ghost /> : <CircleAlert />}
        </div>
        <h1 className="text-2xl font-bold">
          {unauthorized
            ? "Come on in"
            : localSetup
              ? "Local setup needed"
              : "The board went quiet"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {unauthorized
            ? "Sign in with Discord so the site knows which groups and cards are yours."
            : (error?.message ??
              "We couldn’t reach the shared board. Your changes are safe.")}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {unauthorized ? (
            <Button
              disabled={signingIn}
              onClick={async () => {
                setSigningIn(true);
                try {
                  await beginDiscordSignIn();
                } catch (signInError) {
                  toast.error(
                    signInError instanceof Error
                      ? signInError.message
                      : "Discord sign-in failed",
                  );
                  setSigningIn(false);
                }
              }}
            >
              {signingIn ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <LogIn />
              )}
              Sign in with Discord
            </Button>
          ) : (
            <Button onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyWorkspace() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <Ghost className="mx-auto mb-4 size-10 text-orange-500" />
        <h1 className="text-2xl font-bold">No boards yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An organizer can make the first board in Groups.
        </p>
      </div>
    </div>
  );
}
