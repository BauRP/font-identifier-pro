// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import legacy from "@vitejs/plugin-legacy";

// CAPACITOR_BUILD=1 → emit relative asset paths so Android WebView (file://) can resolve them,
// and emit a client manifest so we can generate a static index.html for the APK.
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" },
  },
  vite: {
    plugins: isCapacitor
      ? [
          legacy({
            // Указываем Chrome 70 для совместимости с WebView на Android
            targets: ["chrome 70", "defaults", "not IE 11"],
            // ВКЛЮЧАЕМ ПОЛНУЮ ПОДДЕРЖКУ ПОЛИФИЛЛОВ (решает System is not defined)
            polyfills: true, 
            modernPolyfills: true,
            renderLegacyChunks: true,
            additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
          }),
        ]
      : [],
    define: {
      __CAPACITOR_BUILD__: JSON.stringify(isCapacitor),
      "process.env.CAPACITOR_BUILD": JSON.stringify(isCapacitor ? "1" : "0"),
      global: "globalThis",
    },
    ...(isCapacitor
      ? {
          // КРИТИЧНО: относительные пути для Android
          base: "./",
          build: {
            // ВОЗВРАЩАЕМ РАЗДЕЛЕНИЕ КОДА: чтобы TanStack Start нашел style.css
            cssCodeSplit: true, 
            target: "es2018",
            cssTarget: "chrome70",
            // Отключаем modulePreload, чтобы не путать старые WebView
            modulePreload: false,
            // Используем terser для корректной минификации legacy-кода
            minify: 'terser',
          },
          environments: {
            client: {
              build: {
                manifest: true,
                target: "es2018",
                cssTarget: "chrome70",
              },
            },
          },
        }
      : {}),
  },
});
