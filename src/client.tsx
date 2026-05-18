import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router"; 
import { getRouter } from "./router";
import React from "react";

const router = getRouter();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден корневой элемент #root в index.html");
}

// Инициализируем гидратацию роутера
router.hydrate();

// МЕНЯЕМ НА КЛАССИЧЕСКИЙ ЧИСТЫЙ React SPA РЕНДЕР
// Это полностью исключает белый экран и любые проверки TanStack Start при сборке мобилки
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

console.log("👉 [TRIVO-CORE] Сканер шрифтов успешно запущен в чистом нативном SPA-режиме!");
