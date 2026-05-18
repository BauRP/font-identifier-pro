import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter, createMemoryHistory, createBrowserHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Надежная проверка среды сборки Capacitor
function isCapacitorBuild(): boolean {
  if (typeof window === "undefined") return false;
  
  // 1. Проверяем явный глобальный флаг сборки
  if ((window as any).CAPACITOR_BUILD === true) return true;
  
  // 2. Проверяем наличие нативного моста
  const cap = (window as any).Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    if (typeof cap.getPlatform === "function") return cap.getPlatform() !== "web";
  }
  
  // 3. Проверяем протокол (нативные контейнеры часто используют специфичные схемы)
  if (window.location.protocol === "file:" || window.location.protocol === "capacitor:") return true;
  
  return false;
}

export function getRouter() {
  const queryClient = new QueryClient();
  const isNative = isCapacitorBuild();

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
    // КРИТИЧЕСКИЙ ФИКС ДЛЯ ЧЁРНОГО ЭКРАНА:
    // Если мы на мобилке, жестко изолируем историю в памяти (Memory History),
    // чтобы роутер не пытался дергать системный URL Android WebView
    history: isNative ? createMemoryHistory({ initialEntries: ["/"] }) : createBrowserHistory(),
    ...(isNative ? { defaultSsr: false } : {}),
  });

  return router;
}

// Экспортируем роутер как синглтон для внешних прямых импортов
export const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
