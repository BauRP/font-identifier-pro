#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLIENT_DIR = join(ROOT, "dist", "client");
const DIST_DIR = join(ROOT, "dist");
const MANIFEST_PATH = join(CLIENT_DIR, ".vite", "manifest.json");

console.log("[SPA-FIX] Запуск автономного генератора оболочки...");

if (!existsSync(MANIFEST_PATH)) {
  console.error(`[SPA-FIX] FATAL: Манифест не найден по пути ${MANIFEST_PATH}.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function normalizeClientPath(file) {
  return String(file).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function htmlAssetPath(file) {
  // ВОЗВРАЩАЕМ ТОЧКУ: Идеально для нативной схемы capacitor://
  return `./${normalizeClientPath(file)}`;
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
const cssSet = new Set();

for (const value of Object.values(manifest)) {
  if (value?.file?.endsWith(".css")) cssSet.add(normalizeClientPath(value.file));
  for (const cssFile of value?.css ?? []) cssSet.add(normalizeClientPath(cssFile));
}
for (const file of emittedClientFiles) {
  if (file.endsWith(".css")) cssSet.add(normalizeClientPath(file));
}

const cssTags = [...cssSet]
  .sort()
  .map((href) => `    <link rel="stylesheet" href="${htmlAssetPath(href)}" />`)
  .join("\n");

const ENTRY_KEY_CANDIDATES = [
  "virtual:tanstack-start-client-entry",
  "virtual:tanstack-start/client-entry",
  "tanstack-start-client-entry",
];

let entry = Object.entries(manifest).find(
  ([key, value]) => value?.file && (ENTRY_KEY_CANDIDATES.some((c) => key.includes(c)) || value.isEntry)
)?.[1] ?? null;

if (!entry) {
  const candidates = Object.values(manifest).filter((v) => v?.file && v.file.endsWith(".js") && !v.isDynamicEntry);
  candidates.sort((a, b) => statSync(join(CLIENT_DIR, b.file)).size - statSync(join(CLIENT_DIR, a.file)).size);
  entry = candidates[0] ?? null;
}

if (!entry?.file) {
  console.error("[SPA-FIX] FATAL: Не удалось определить точку входа JS.");
  process.exit(1);
}

// УБРАЛИ type="module": Теперь старые движки Android WebView загрузят скрипт без CORS-блокировок
const entryScriptTag = `    <script src="${htmlAssetPath(entry.file)}"></script>`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>FontScan Elite</title>
${cssTags}
${entryScriptTag}
</head>
<body>
    <div id="root"></div>
</body>
</html>`;

writeFileSync(join(DIST_DIR, "index.html"), htmlContent, "utf8");

if (existsSync(CLIENT_DIR)) {
  cpSync(CLIENT_DIR, DIST_DIR, { recursive: true });
}

console.log("[SPA-FIX] 👉 SUCCESS: Чистый index.html создан без модульных тегов!");
