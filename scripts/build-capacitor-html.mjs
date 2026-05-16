#!/usr/bin/env node
/**
 * Post-build step for Capacitor APK.
 *
 * TanStack Start emits a client build that is normally consumed by a server-rendered
 * shell. Capacitor loads static files from the Android asset bridge instead, so the
 * native APK requires a deterministic SPA shell with fully relative asset paths.
 *
 * This generator is intentionally strict:
 *   1. It reads the Vite client manifest emitted during CAPACITOR_BUILD=1.
 *   2. It discovers the modern client entry and all required CSS.
 *   3. It discovers the legacy SystemJS/polyfill runtime by manifest and filesystem
 *      regex fallbacks, reads the runtime file from disk, and inlines it as the
 *      first blocking script in <head>.
 *   4. It discovers the legacy entry chunk and runs it at the trailing boundary of
 *      <body> behind a nomodule script without async/defer.
 *   5. It writes dist/client/index.html, then flattens dist/client/* into dist/ so
 *      capacitor.config.ts (webDir: "dist") and npx cap sync copy the patched shell.
 */
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const DIST_DIR = join(ROOT, "dist");
const MANIFEST_PATH = join(CLIENT_DIR, ".vite", "manifest.json");

function fail(message, details) {
  console.error(`[capacitor-html] ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

if (!existsSync(MANIFEST_PATH)) {
  fail(`Missing manifest at ${MANIFEST_PATH}.`, "Did you run with CAPACITOR_BUILD=1?");
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function normalizeClientPath(file) {
  return String(file).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function htmlAssetPath(file) {
  return `./${normalizeClientPath(file)}`;
}

function clientFilePath(file) {
  return join(CLIENT_DIR, normalizeClientPath(file));
}

function readClientFile(file) {
  return readFileSync(clientFilePath(file), "utf8");
}

function clientFileSize(file) {
  return statSync(clientFilePath(file)).size;
}

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
      files.push(normalizeClientPath(relative));
    }
  }
  return files;
}

const emittedClientFiles = walkFiles(CLIENT_DIR);
const emittedClientFileSet = new Set(emittedClientFiles);
const emittedJavaScriptFiles = emittedClientFiles.filter((file) => file.endsWith(".js"));
const emittedHtmlFiles = emittedClientFiles.filter((file) => file.endsWith(".html"));

const manifestFiles = new Set();
for (const value of Object.values(manifest)) {
  if (value?.file) manifestFiles.add(normalizeClientPath(value.file));
  for (const cssFile of value?.css ?? []) manifestFiles.add(normalizeClientPath(cssFile));
  for (const assetFile of value?.assets ?? []) manifestFiles.add(normalizeClientPath(assetFile));
}

const ENTRY_KEY_CANDIDATES = [
  "virtual:tanstack-start-client-entry",
  "virtual:tanstack-start/client-entry",
  "tanstack-start-client-entry",
];

function isLegacyRuntimePath(file) {
  const normalized = normalizeClientPath(file);
  return (
    /(^|\/)polyfills-legacy(?:-[\w.-]+)?\.js$/i.test(normalized) ||
    /(^\/|\/)?(?:system|systemjs)(?:[-.][\w.-]+)?\.js$/i.test(normalized) ||
    /(^|\/)s(?:[-.][\w.-]+)?\.js$/i.test(normalized)
  );
}

function isLegacyEntryPath(file) {
  const normalized = normalizeClientPath(file);
  return /(^|\/)[\w.-]+-legacy-[\w.-]+\.js$/i.test(normalized) && !isLegacyRuntimePath(normalized);
}

function isModernEntryPath(file) {
  const normalized = normalizeClientPath(file);
  return normalized.endsWith(".js") && !isLegacyEntryPath(normalized) && !isLegacyRuntimePath(normalized);
}

let entry =
  Object.entries(manifest).find(
    ([key, value]) =>
      value?.file &&
      isModernEntryPath(value.file) &&
      (ENTRY_KEY_CANDIDATES.some((candidate) => key.includes(candidate)) || value.isEntry),
  )?.[1] ?? null;

if (!entry) {
  const candidates = Object.values(manifest).filter(
    (value) => value?.file && isModernEntryPath(value.file) && !value.isDynamicEntry,
  );
  candidates.sort((a, b) => clientFileSize(b.file) - clientFileSize(a.file));
  entry = candidates[0] ?? null;
}

if (!entry?.file || !emittedClientFileSet.has(normalizeClientPath(entry.file))) {
  fail(
    "Could not locate a modern client entry in the Vite manifest.",
    JSON.stringify(manifest, null, 2),
  );
}

const cssSet = new Set();
const visitedManifestKeys = new Set();
function collectCss(manifestKey) {
  if (visitedManifestKeys.has(manifestKey)) return;
  visitedManifestKeys.add(manifestKey);
  const manifestEntry = manifest[manifestKey];
  if (!manifestEntry) return;
  for (const cssFile of manifestEntry.css ?? []) cssSet.add(normalizeClientPath(cssFile));
  for (const importedKey of manifestEntry.imports ?? []) collectCss(importedKey);
}

const entryKey = Object.keys(manifest).find((key) => manifest[key] === entry);
if (entryKey) collectCss(entryKey);

for (const value of Object.values(manifest)) {
  if (value?.file?.endsWith(".css")) cssSet.add(normalizeClientPath(value.file));
}
for (const file of emittedClientFiles) {
  if (file.endsWith(".css")) cssSet.add(normalizeClientPath(file));
}

const cssTags = [...cssSet]
  .sort()
  .map((href) => `    <link rel="stylesheet" href="${htmlAssetPath(href)}" />`)
  .join("\n");

const legacyRuntimeRegexes = [
  /(^|\/)polyfills-legacy(?:-[\w.-]+)?\.js$/i,
  /(^|\/)(?:system|systemjs)(?:[-.][\w.-]+)?\.js$/i,
  /(^|\/)s(?:[-.][\w.-]+)?\.js$/i,
];

function getLegacyRuntimeScore(file) {
  const normalized = normalizeClientPath(file);
  const name = basename(normalized);
  let score = 0;

  if (/^polyfills-legacy-[\w.-]+\.js$/i.test(name)) score += 1_000;
  if (/^polyfills-legacy\.js$/i.test(name)) score += 950;
  if (/^(?:system|systemjs)(?:[-.][\w.-]+)?\.js$/i.test(name)) score += 900;
  if (/^s(?:[-.][\w.-]+)?\.js$/i.test(name)) score += 700;
  if (manifestFiles.has(normalized)) score += 100;

  const content = readClientFile(normalized);
  if (/\bSystem\b|SystemJS|systemJSPrototype|\bregister\s*[:=]\s*function/.test(content)) score += 250;
  if (/\bSystem\.import\b|\bSystem\.register\b/.test(content)) score += 100;

  return score;
}

const legacyRuntimeCandidates = emittedJavaScriptFiles
  .filter((file) => legacyRuntimeRegexes.some((regex) => regex.test(file)))
  .map((file) => ({ file, score: getLegacyRuntimeScore(file) }))
  .filter((candidate) => candidate.score > 0)
  .sort((a, b) => b.score - a.score || clientFileSize(a.file) - clientFileSize(b.file));

const legacyRuntimeFile = legacyRuntimeCandidates[0]?.file ?? null;

if (!legacyRuntimeFile) {
  fail(
    "Could not discover a legacy SystemJS/polyfill runtime file.",
    [
      "Expected a compiled asset matching one of:",
      "  - assets/polyfills-legacy-[hash].js",
      "  - assets/polyfills-legacy.js",
      "  - assets/system-[hash].js",
      "  - assets/systemjs-[hash].js",
      "  - assets/s-[hash].js",
      "Emitted JavaScript files:",
      ...emittedJavaScriptFiles.map((file) => `  - ${file}`),
    ].join("\n"),
  );
}

const legacyRuntimeSource = readClientFile(legacyRuntimeFile);
if (!/\bSystem\b|SystemJS|systemJSPrototype/.test(legacyRuntimeSource)) {
  fail(
    `Discovered legacy runtime ${legacyRuntimeFile}, but it does not appear to initialize SystemJS.`,
    "Refusing to generate an Android shell that can crash with ReferenceError: System is not defined.",
  );
}

function extractLegacyEntryFromHtml() {
  const discovered = [];
  const dataSrcRegex = /<script\b(?=[^>]*\bid=["']vite-legacy-entry["'])(?=[^>]*\bdata-src=["']([^"']+)["'])[^>]*>/gi;
  const systemImportRegex = /System\.import\(\s*["']([^"']+-legacy-[^"']+\.js)["']\s*\)/gi;

  for (const htmlFile of emittedHtmlFiles) {
    const source = readClientFile(htmlFile);
    for (const match of source.matchAll(dataSrcRegex)) discovered.push(normalizeClientPath(match[1]));
    for (const match of source.matchAll(systemImportRegex)) discovered.push(normalizeClientPath(match[1]));
  }

  return discovered.filter((file) => emittedClientFileSet.has(file) && isLegacyEntryPath(file));
}

function getLegacyEntryScore(file) {
  const normalized = normalizeClientPath(file);
  const name = basename(normalized);
  let score = 0;

  if (/^index-legacy-[\w.-]+\.js$/i.test(name)) score += 1_000;
  if (/^client-legacy-[\w.-]+\.js$/i.test(name)) score += 900;
  if (/^entry-legacy-[\w.-]+\.js$/i.test(name)) score += 850;
  if (manifestFiles.has(normalized)) score += 100;

  const content = readClientFile(normalized);
  if (/\bSystem\.register\b/.test(content)) score += 200;
  if (/virtual:tanstack-start|tanstack-start|createRoot|hydrateRoot|RouterProvider|StartClient/.test(content)) {
    score += 150;
  }

  return score;
}

const legacyEntryFromHtml = extractLegacyEntryFromHtml();
const legacyEntryCandidates = [
  ...new Set([
    ...legacyEntryFromHtml,
    ...emittedJavaScriptFiles.filter((file) => isLegacyEntryPath(file) && file !== legacyRuntimeFile),
  ]),
]
  .map((file) => ({ file, score: getLegacyEntryScore(file) }))
  .filter((candidate) => candidate.score > 0)
  .sort((a, b) => b.score - a.score || clientFileSize(b.file) - clientFileSize(a.file));

const legacyEntryFile = legacyEntryCandidates[0]?.file ?? null;

if (!legacyEntryFile) {
  fail(
    "Could not discover the legacy entry chunk required by @vitejs/plugin-legacy.",
    [
      "Expected a compiled asset similar to assets/index-legacy-[hash].js.",
      "This build is intentionally failing instead of producing a shell where System.import cannot run.",
      "Emitted JavaScript files:",
      ...emittedJavaScriptFiles.map((file) => `  - ${file}`),
    ].join("\n"),
  );
}

function escapeInlineScript(source) {
  return source
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const inlinedLegacyRuntimeScript = `    <script id="vite-systemjs-loader">\n${escapeInlineScript(
  legacyRuntimeSource,
)}\n    </script>`;

const legacyEntryTag = `    <script nomodule crossorigin id="vite-legacy-entry" data-src="${htmlAssetPath(
  legacyEntryFile,
)}">(function(){var e=document.getElementById('vite-legacy-entry');var s=e&&e.getAttribute('data-src');if(!window.System||typeof window.System.import!=='function'){throw new Error('SystemJS runtime failed to initialize before legacy entry execution.');}window.System.import(s);})();</script>`;

const csp = [
  "default-src 'self' capacitor: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: capacitor: https:",
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
${inlinedLegacyRuntimeScript}
${cssTags}
  </head>
  <body>
    <div id="root"></div>
    <script>${safetyNetScript}</script>
    <script type="module" src="${htmlAssetPath(entry.file)}"></script>
${legacyEntryTag}
  </body>
</html>
`;

html = html
  .replace(/src="\/assets\//g, 'src="./assets/')
  .replace(/href="\/assets\//g, 'href="./assets/')
  .replace(/data-src="\/assets\//g, 'data-src="./assets/');

if (/\s(?:async|defer)\b/i.test(html)) {
  fail("Generated Capacitor HTML contains async/defer attributes, which are forbidden for the legacy boot pipeline.");
}

if (/(?:src|href|data-src)="\/assets\//.test(html)) {
  fail("Generated Capacitor HTML contains absolute /assets/ paths instead of relative ./assets/ paths.");
}

if (/<script\b[^>]*\bsrc=["'][^"']*(?:polyfills-legacy|system|systemjs|\/s(?:[-.][\w.-]+)?\.js)[^"']*["'][^>]*>/i.test(html)) {
  fail("Generated Capacitor HTML references the legacy SystemJS/polyfill runtime externally instead of inlining it.");
}

if (!html.includes("'unsafe-inline'") || !html.includes("'unsafe-eval'")) {
  fail("Generated Capacitor CSP is missing script-src 'unsafe-inline' or 'unsafe-eval'.");
}

writeFileSync(join(CLIENT_DIR, "index.html"), html);
console.log(`[capacitor-html] Inlined legacy runtime: ${legacyRuntimeFile}`);
console.log(`[capacitor-html] Bound legacy entry: ${legacyEntryFile}`);
console.log(`[capacitor-html] Wrote dist/client/index.html (modern entry: ${entry.file})`);

for (const name of readdirSync(CLIENT_DIR)) {
  const source = join(CLIENT_DIR, name);
  const destination = join(DIST_DIR, name);
  if (name === ".vite") continue;
  if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}

const flattenedIndexPath = join(DIST_DIR, "index.html");
if (!existsSync(flattenedIndexPath)) {
  fail("dist/index.html was not produced after flattening dist/client/* into dist/.");
}

const flattenedIndex = readFileSync(flattenedIndexPath, "utf8");
if (!flattenedIndex.includes('id="vite-systemjs-loader"') || !flattenedIndex.includes("SystemJS")) {
  fail("dist/index.html does not contain the inlined legacy SystemJS/polyfill runtime.");
}
if (/(?:src|href|data-src)="\/assets\//.test(flattenedIndex)) {
  fail("dist/index.html contains absolute /assets/ references after flattening.");
}

console.log("[capacitor-html] Flattened dist/client/* into dist/ for Capacitor webDir ingestion.");
