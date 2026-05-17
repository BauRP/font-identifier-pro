import { QueryClient } from "@tanstack/react-query";
import { createRouter, createMemoryHistory } from "@tanstack/react-router";
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

export const getRouter = () => {
  const queryClient = new QueryClient();
  const isNative = isCapacitorBuild();

  // Для Capacitor используем изолированную Memory History, для Web — стандартный режим
  const historyInstance = isNative 
    ? createMemoryHistory({ initialEntries: ["/"] }) 
    : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    history: historyInstance,
    ...(isNative ? { defaultSsr: false } : {}),
  });

  return router;
};
