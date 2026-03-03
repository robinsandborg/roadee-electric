import { useEffect } from "react";
import { syncPostsIntoCollections } from "#/lib/posts/sync";

export function usePostsSync(enabled: boolean, spaceSlug: string | null | undefined): void {
  useEffect(() => {
    const normalizedSpaceSlug = spaceSlug?.trim().toLowerCase() ?? "";
    if (!enabled || !normalizedSpaceSlug) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = async () => {
      if (cancelled) {
        return;
      }

      try {
        await syncPostsIntoCollections(normalizedSpaceSlug);
      } catch {
        // Sync errors are surfaced in route-level actions where relevant.
      }
    };

    void pull();
    timer = setInterval(() => {
      void pull();
    }, 3500);

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [enabled, spaceSlug]);
}
