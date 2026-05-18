import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router"; 
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
  // ДЛЯ МОБИЛЬНЫХ (ОБХОД БЕЛОГО ЭКРАНА): Чистый клиентский запуск без серверных модулей
  const root = createRoot(rootElement);
  router.hydrate();
  
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
  
  console.log("👉 [TRIVO-CORE] Сканер шрифтов запущен в чистом мобильном SPA-режиме!");
} else {
  // ДЛЯ ВЕБ-САЙТА: Динамически загружаем StartClient, чтобы Rollup не ругался при сборке
  import("@tanstack/start/client").then(({ StartClient }) => {
    hydrateRoot(rootElement, <React.StrictMode><StartClient router={router} /></React.StrictMode>);
  }).catch((err) => {
    console.error("Ошибка гидратации веб-версии:", err);
  });
}
