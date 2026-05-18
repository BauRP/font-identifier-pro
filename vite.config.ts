// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";

// ВОЗВРАЩАЕМ ДИНАМИЧЕСКИЙ ФЛАГ
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" }, 
    
    prerender: {
      enabled: true, 
      crawl: true,
      routes: ["/"] 
    },
    ...(isCapacitor
      ? {
          spa: {},
          ssr: false,
        }
      : {}),
  },
  vite: {
    preview: {
      host: "127.0.0.1", 
      port: 3000,
    },
    resolve: {
      alias: {},
    },
    plugins: [
      {
        name: "fix-tanstack-server-filename",
        closeBundle() {
          try {
            const serverDir = path.resolve(process.cwd(), "dist/server");
            if (fs.existsSync(serverDir)) {
              const indexPath = path.join(serverDir, "index.js");
              const serverPath = path.join(serverDir, "server.js");
              if (fs.existsSync(indexPath) && !fs.existsSync(serverPath)) {
                fs.copyFileSync(indexPath, serverPath);
                console.log("👉 [HACK] Успешно скопирован index.js в server.js для пререндера!");
              }
            }
          } catch (error) {
            console.error("Ошибка при копировании серверного файла:", error);
          }
        },
      },
    ],
    define: {
      __CAPACITOR_BUILD__: JSON.stringify(isCapacitor),
      "process.env.CAPACITOR_BUILD": JSON.stringify(isCapacitor ? "1" : "0"),
      global: "globalThis",
    },
    build: {
      // ИГНОРИРУЕМ СЕРВЕРНЫЙ МОДУЛЬ ДЛЯ СБОРКИ ЧИСТОГО АПК
      rollupOptions: {
        external: isCapacitor ? ["@tanstack/start/client", "@tanstack/start"] : [],
      },
      ...(isCapacitor
        ? {
            manifest: true,
            cssCodeSplit: true,
            target: "es2020",
            modulePreload: false,
            minify: "terser",
            terserOptions: {
              ecma: 2020,
              module: false,
              toplevel: false,
              keep_classnames: true,
              keep_fnames: true,
              compress: {
                defaults: true,
                module: false,
                toplevel: false,
                side_effects: false,
                unused: false,
              },
            },
          }
        : {}),
    },
  },
});
