import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router"; 
import { getRouter } from "./router";
import React from "react";

const router = getRouter();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден корневой элемент #root в index.html");
}

const isCapacitor = typeof window !== "undefined" && 
  ((window as any).CAPACITOR_BUILD === true || 
   (window as any).Capacitor || 
   window.location.protocol === "capacitor:" || 
   window.location.protocol === "file:");

const root = createRoot(rootElement);

if (!isCapacitor) {
  // УДАЛЕНО ДЛЯ МОБИЛОК: Гидратацию вызываем исключительно в Web-версии, 
  // чтобы избежать зависания рантайма на чёрном экране при MemoryHistory
  router.hydrate();
}

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

console.log("👉 [TRIVO-CORE] Рендеринг интерфейса сканера шрифтов запущен.");
