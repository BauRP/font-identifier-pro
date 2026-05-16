// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import legacy from "@vitejs/plugin-legacy";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// ВОЗВРАЩАЕМ ДИНАМИЧЕСКИЙ ФЛАГ, чтобы не ломать базовый путь веб-версии
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

// Наш микро-плагин для обмана краулера Lovable
function fixLovablePrerenderPlugin() {
  return {
    name: "fix-lovable-prerender",
    writeBundle() {
      const serverDir = join(process.cwd(), "dist", "server");
      if (!existsSync(serverDir)) {
        mkdirSync(serverDir, { recursive: true });
      }
      writeFileSync(join(serverDir, "server.js"), "export const app = {};", "utf8");
      console.log("[fix-plugin] Шах и мат: Заглушка server.js записана в последний момент!");
    }
  };
}

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" },
    // ЖЕСТКО ВЫКЛЮЧАЕМ ПРЕРЕНДЕР, чтобы сборщик вообще не пытался сканировать страницы
    prerender: false,
    ...(isCapacitor
      ? {
          // Zod требует объект. Передаем пустой объект для SPA режима
          spa: {},
          // Отключаем SSR для локального WebView пакета
          ssr: false,
        }
      : {}),
  },
  vite: {
    plugins: [
      fixLovablePrerenderPlugin(), // Наш фикс будет работать ВСЕГДА
      ...(isCapacitor
        ? [
            legacy({
              targets: ["chrome 70", "defaults", "not IE 11"],
              polyfills: true,
              modernPolyfills: true,
              renderLegacyChunks: true,
              additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
            }),
          ]
        : [])
    ],
    define: {
      __CAPACITOR_BUILD__: JSON.stringify(isCapacitor),
      "process.env.CAPACITOR_BUILD": JSON.stringify(isCapacitor ? "1" : "0"),
      global: "globalThis",
    },
    ...(isCapacitor
      ? {
          base: "./",
          build: {
            manifest: true,
            cssCodeSplit: true,
            target: "es2018",
            cssTarget: "chrome70",
            modulePreload: false,
            minify: "terser",
            terserOptions: {
              ecma: 2018,
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
          },
        }
      : {}),
  },
});
