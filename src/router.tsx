import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Capacitor detection — only meaningful on the client.
function isCapacitorClient(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).CAPACITOR_BUILD === true) return true;
  const cap = (window as any).Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    if (typeof cap.getPlatform === "function") return cap.getPlatform() !== "web";
  }
  if (window.location.protocol === "file:" || window.location.protocol === "capacitor:") return true;
  return false;
}

export function getRouter() {
  const queryClient = new QueryClient();
  const isNative = isCapacitorClient();

  // On the server we MUST NOT call createBrowserHistory (no window). Let
  // TanStack pick its default SSR-safe history. Only override for Capacitor.
  return createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
    ...(isNative
      ? { history: createMemoryHistory({ initialEntries: ["/"] }), defaultSsr: false }
      : {}),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
