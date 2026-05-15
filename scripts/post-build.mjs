#!/usr/bin/env node
/**
 * Universal post-build hook.
 * When CAPACITOR_BUILD=1, runs the Capacitor SPA shell generator that emits
 * dist/index.html with relative asset paths so the Android WebView can boot
 * from file://. For normal (Cloudflare/SSR) builds this is a no-op.
 */
import { spawnSync } from "node:child_process";

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
