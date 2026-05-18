import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router"; 
import { getRouter } from "./router";
import React from "react";

const router = getRouter();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден корневой элемент #root в index.html");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

console.log("👉 [TRIVO-CORE] Рендеринг интерфейса сканера шрифтов запущен.");
