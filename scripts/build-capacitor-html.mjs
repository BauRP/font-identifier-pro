#!/usr/bin/env node
/**
 * Post-build step for Capacitor APK.
 *
 * TanStack Start emits a client build that is normally consumed by a server-rendered
 * shell. Capacitor loads static files from the Android asset bridge instead, so the
 * native APK requires a deterministic SPA shell with fully relative asset paths.
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

function escapeInlineScript(source) {
  return source
    .split("</script").join("<\\/script")
    .split("
