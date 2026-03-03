import { useEffect } from "react";
import { syncVisibleSpacesIntoCollections } from "#/lib/v1/sync";

export function useV1SpacesSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = async () => {
      if (cancelled) {
        return;
      }

      try {
        await syncVisibleSpacesIntoCollections();
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
  }, [enabled]);
}
