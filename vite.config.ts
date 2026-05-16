// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import legacy from "@vitejs/plugin-legacy";

const isCapacitor = process.env.CAPACITOR_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" },
    ...(isCapacitor
      ? {
          prerender: {
            enabled: false,
            autoStaticPathsDiscovery: false,
            failOnError: false,
          },
        }
      : {}),
  },
  vite: {
    plugins: isCapacitor
      ? [
          legacy({
            targets: ["chrome 70", "defaults", "not IE 11"],
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
