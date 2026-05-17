#!/usr/bin/env node
/**
 * Universal post-build hook.
 * When CAPACITOR_BUILD=1, runs the Capacitor SPA shell generator that emits
 * dist/index.html with relative asset paths so the Android WebView can boot
 * from file://. For normal (Cloudflare/SSR) builds this is a no-op.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Write the Lovable prerender stub AFTER vite build (and any TanStack
// prerender step) has fully terminated. Doing this inside a Vite plugin
// hook (writeBundle/closeBundle) races with TanStack's prerender server
// which tries to import dist/server/server.js and crashes with 500.
function writeLovablePrerenderStub() {
  const serverDir = join(process.cwd(), "dist", "server");
  if (!existsSync(serverDir)) {
    mkdirSync(serverDir, { recursive: true });
  }
  writeFileSync(join(serverDir, "server.js"), "export const app = {};", "utf8");
  console.log("[post-build] Lovable prerender stub written to dist/server/server.js");
}

writeLovablePrerenderStub();

if (process.env.CAPACITOR_BUILD !== "1") {
  console.log("[post-build] Standard build — skipping Capacitor SPA shell.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["scripts/build-capacitor-html.mjs"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
