import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// On native Capacitor builds, file:// / https://localhost has no real history API,
// so pushState routing produces a white screen. Use hash routing on the client
// when running inside the Capacitor WebView.
function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  if (typeof cap.getPlatform === "function") return cap.getPlatform() !== "web";
  return false;
}

export const getRouter = () => {
  const queryClient = new QueryClient();
  const native = isCapacitorNative();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(native ? { history: createHashHistory(), defaultSsr: false } : {}),
  });

  return router;
};
