// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// ВОЗВРАЩАЕМ ДИНАМИЧЕСКИЙ ФЛАГ
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" },
    // ЖЕСТКО ВЫРУБАЕМ СЛОМАННЫЙ ПРЕРЕНДЕР С ГАРАНТИЕЙ
    prerender: {
      enabled: false, 
      crawl: false,
      routes: []
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
      host: true, // Разрешаем внешние подключения к серверу пререндера в среде CI
    },
    plugins: [],
    define: {
      __CAPACITOR_BUILD__: JSON.stringify(isCapacitor),
      "process.env.CAPACITOR_BUILD": JSON.stringify(isCapacitor ? "1" : "0"),
      global: "globalThis",
    },
    ...(isCapacitor
      ? {
          build: {
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
          },
        }
      : {}),
  },
});
