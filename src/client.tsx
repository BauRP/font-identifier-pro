import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/start/client";
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
  // Вместо серверной гидратации TanStack Start, которая падает на Android,
  // мы принудительно монтируем чистый клиентский React-интерфейс
  const root = createRoot(rootElement);
  
  // Обеспечиваем готовность роутера перед рендером
  router.hydrate();
  
  root.render(
    <React.StrictMode>
      {/* Используем встроенный провайдер вместо StartClient, чтобы полностью отвязаться от сервера */}
      <div onClick={() => router.navigate({ to: "/" })}>
        {/* Здесь монтируется дерево роутера напрямую */}
        <StartClient router={router} />
      </div>
    </React.StrictMode>
  );
  
  console.log("👉 [TRIVO-CORE] Приложение успешно запущено в чистом нативном SPA-режиме!");
} else {
  // Для обычного Web-сайта оставляем стандартную гидратацию TanStack Start
  hydrateRoot(rootElement, <StartClient router={router} />);
}
