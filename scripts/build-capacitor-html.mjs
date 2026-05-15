#!/usr/bin/env node
/**
 * Post-build step for Capacitor APK.
 *
 * TanStack Start is SSR-only and does not emit a static index.html — the HTML
 * shell is rendered by the server (Cloudflare Worker) at request time. Capacitor
 * loads files from the device filesystem (file://) where there is no server, so
 * we need a static SPA shell that bootstraps the client bundle.
 *
 * This script:
 *   1. Reads the Vite client manifest (enabled via CAPACITOR_BUILD=1).
 *   2. Finds the TanStack Start client entry chunk + its CSS.
 *   3. Writes dist/client/index.html that loads them with relative paths.
 *   4. Flattens dist/client/* up to dist/ so capacitor.config.ts (webDir: "dist")
 *      sees index.html at the root.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const DIST_DIR = join(ROOT, "dist");
const MANIFEST_PATH = join(CLIENT_DIR, ".vite", "manifest.json");

if (!existsSync(MANIFEST_PATH)) {
  console.error(`[capacitor-html] Missing manifest at ${MANIFEST_PATH}.`);
  console.error("                  Did you run with CAPACITOR_BUILD=1?");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

// TanStack Start exposes the client bootstrap under one of these virtual ids.
const ENTRY_KEY_CANDIDATES = [
  "virtual:tanstack-start-client-entry",
  "virtual:tanstack-start/client-entry",
  "tanstack-start-client-entry",
];

let entry =
  Object.entries(manifest).find(([k, v]) =>
    ENTRY_KEY_CANDIDATES.some((c) => k.includes(c)) || v.isEntry,
  )?.[1] ?? null;

if (!entry) {
  // Fallback: pick the largest non-dynamic .js as the entry.
  const candidates = Object.values(manifest).filter(
    (v) => v.file?.endsWith(".js") && !v.isDynamicEntry,
  );
  candidates.sort((a, b) => {
    const sa = statSync(join(CLIENT_DIR, a.file)).size;
    const sb = statSync(join(CLIENT_DIR, b.file)).size;
    return sb - sa;
  });
  entry = candidates[0];
}

if (!entry?.file) {
  console.error("[capacitor-html] Could not locate a client entry in manifest.");
  console.error(JSON.stringify(manifest, null, 2));
  process.exit(1);
}

// Collect all CSS referenced by entry + its imports (recursive).
const cssSet = new Set();
const visited = new Set();
function collectCss(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const e = manifest[key];
  if (!e) return;
  (e.css ?? []).forEach((c) => cssSet.add(c));
  (e.imports ?? []).forEach(collectCss);
}
const entryKey = Object.keys(manifest).find((k) => manifest[k] === entry);
if (entryKey) collectCss(entryKey);

// Also include any standalone CSS chunks emitted by Tailwind / styles.css.
for (const v of Object.values(manifest)) {
  if (v.file?.endsWith(".css")) cssSet.add(v.file);
}

const cssTags = [...cssSet]
  .map((href) => `    <link rel="stylesheet" href="./${href}" />`)
  .join("\n");

function walkFiles(dir, prefix = "") {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === ".vite") continue;
    const absolute = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(absolute).isDirectory()) {
      files.push(...walkFiles(absolute, relative));
    } else {
      files.push(relative);
    }
  }
  return files;
}

const emittedClientFiles = walkFiles(CLIENT_DIR);
const legacyPolyfillFile = emittedClientFiles
  .filter((file) => /(^|\/)polyfills-legacy-[\w.-]+\.js$/.test(file))
  .sort()[0];
const legacyEntryFile = emittedClientFiles
  .filter((file) => /-legacy-[\w.-]+\.js$/.test(file) && !/(^|\/)polyfills-legacy-[\w.-]+\.js$/.test(file))
  .sort((a, b) => statSync(join(CLIENT_DIR, b)).size - statSync(join(CLIENT_DIR, a)).size)[0];

const legacyTags = [
  legacyPolyfillFile
    ? `    <script nomodule crossorigin id="vite-legacy-polyfill" src="./${legacyPolyfillFile}"></script>`
    : "",
  legacyEntryFile
    ? `    <script nomodule crossorigin id="vite-legacy-entry" data-src="./${legacyEntryFile}">System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))</script>`
    : "",
]
  .filter(Boolean)
  .join("\n");

const csp = [
  "default-src 'self' capacitor: https:",
  "script-src 'self' 'unsafe-inline' blob: capacitor:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: capacitor: https:",
  "font-src 'self' data: blob: https://fonts.gstatic.com https://drive.google.com https://storage.googleapis.com https://cdn.jsdelivr.net",
  "connect-src 'self' data: blob: capacitor: https://drive.google.com https://storage.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://project--cb1967de-aa1b-4a89-aab8-185d0f94235a-dev.lovable.app https://ai.gateway.lovable.dev",
  "worker-src 'self' blob:",
].join("; ");

const safetyNetScript = String.raw`(() => {
  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[char] || char);
  const showCrash = (title, reason) => {
    const message = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : '';
    const text = title + '\n' + message + (stack ? '\n\n' + stack : '');
    try { alert(text.slice(0, 1800)); } catch (_) {}
    const target = document.getElementById('root') || document.body;
    target.innerHTML = '<div style="min-height:100vh;background:#05080d;color:#d8fff9;padding:24px;font-family:monospace;box-sizing:border-box;white-space:pre-wrap;overflow:auto;"><h1 style="margin:0 0 16px;font-size:20px;color:#64fff0;">FontScan Elite runtime crash</h1><p style="margin:0 0 12px;">' + escapeHtml(title) + '</p><pre style="font-size:12px;line-height:1.5;">' + escapeHtml(message) + (stack ? '\n\n' + escapeHtml(stack) : '') + '</pre></div>';
  };
  window.onerror = (message, source, lineno, colno, error) => {
    showCrash('window.onerror at ' + (source || 'unknown') + ':' + (lineno || 0) + ':' + (colno || 0), error || message);
    return true;
  };
  window.onunhandledrejection = (event) => showCrash('window.onunhandledrejection', event.reason);
})();`;

let html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>TRIVO Font Scanner</title>
${cssTags}
  </head>
  <body>
    <div id="root"></div>
    <script>${safetyNetScript}</script>
${legacyTags ? `${legacyTags}\n` : ""}
    <script type="module" src="./${entry.file}"></script>
  </body>
</html>
`;

html = html
  .replace(/src="\/assets\//g, 'src="./assets/')
  .replace(/href="\/assets\//g, 'href="./assets/');

writeFileSync(join(CLIENT_DIR, "index.html"), html);
console.log(`[capacitor-html] Wrote dist/client/index.html (entry: ${entry.file})`);

// Flatten dist/client/* -> dist/ so capacitor (webDir: "dist") finds index.html.
// We keep dist/server/ alongside (Capacitor ignores it, Cloudflare needs it).
for (const name of readdirSync(CLIENT_DIR)) {
  const src = join(CLIENT_DIR, name);
  const dest = join(DIST_DIR, name);
  if (name === ".vite") continue; // skip internal manifest dir
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}
console.log(`[capacitor-html] Flattened dist/client/* into dist/`);
