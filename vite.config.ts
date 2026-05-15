// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import legacy from "@vitejs/plugin-legacy";
import { viteSingleFile } from "vite-plugin-singlefile";

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
            targets: ["chrome 70", "defaults"],
            polyfills: true,
            modernPolyfills: true,
            renderLegacyChunks: true,
          }),
          viteSingleFile({ removeViteModuleLoader: true }),
        ]
      : [],
    define: {
      __CAPACITOR_BUILD__: JSON.stringify(isCapacitor),
      "process.env.CAPACITOR_BUILD": JSON.stringify(isCapacitor ? "1" : "0"),
      global: "globalThis",
    },
    ...(isCapacitor
      ? {
          base: "./",
          build: {
            target: "es2018",
            cssTarget: "chrome70",
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
