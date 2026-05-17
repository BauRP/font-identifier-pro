import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/start/client";
import { RouterProvider } from "@tanstack/react-router"; // Добавили чистый клиентский провайдер для SPA-режима
import { getRouter } from "./router";
import React from "react";

const router = getRouter();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден корневой элемент #root в index.html");
}

// Проверяем, запущено ли приложение в режиме Capacitor
const isCapacitor = typeof window !== "undefined" && 
  ((window as any).CAPACITOR_BUILD === true || 
   (window as any).Capacitor || 
   window.location.protocol === "capacitor:" || 
   window.location.protocol === "file:");

if (isCapacitor) {
  // ЖЕСТКИЙ ОБХОД БЕЛОГО ЭКРАНА:
  // На мобильных устройствах полностью убираем серверный StartClient, 
  // заменяя его на чистый клиентский RouterProvider, чтобы избежать падения Rollup
  const root = createRoot(rootElement);
  
  // Обеспечиваем готовность роутера перед рендером
  router.hydrate();
  
  root.render(
    <React.StrictMode>
      {/* Прямой нативный рендеринг дерева роутера без серверных компонентов */}
      <RouterProvider router={router} />
    </React.StrictMode>
  );
  
  console.log("👉 [TRIVO-CORE] Приложение успешно запущено в чистом нативном SPA-режиме!");
} else {
  // Для обычного Web-сайта оставляем стандартную гидратацию TanStack Start
  hydrateRoot(rootElement, <StartClient router={router} />);
}
