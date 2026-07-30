import { useEffect } from "react";
import { isSocketLive } from "../socket";

/**
 * Keeps board data fresh where WebSockets are unavailable (Vercel serverless).
 * Skips the fetch while a socket is connected, and while the tab is hidden.
 */
export function usePollingFallback(callback: () => void, intervalMs = 30000) {
  useEffect(() => {
    const id = setInterval(() => {
      if (isSocketLive()) return;
      if (typeof document !== "undefined" && document.hidden) return;
      callback();
    }, intervalMs);
    return () => clearInterval(id);
  }, [callback, intervalMs]);
}
