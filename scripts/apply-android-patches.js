#!/usr/bin/env node
/**
 * FontScan Elite — Android patcher.
 * Copies pre-built native config (build.gradle, AndroidManifest.xml, etc.)
 * into android/ after `npx cap add android` has scaffolded the project.
 * Idempotent — safe to run multiple times in CI.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'scripts', 'native-config');
const ANDROID = path.join(ROOT, 'android');

if (!fs.existsSync(ANDROID)) {
  console.warn('[patch] android/ not present yet — skipping (run after `cap add android`).');
  process.exit(0);
}

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[patch] missing source: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[patch] wrote ${path.relative(ROOT, dest)}`);
}

copy(path.join(SRC, 'build.gradle'),         path.join(ANDROID, 'app', 'build.gradle'));
copy(path.join(SRC, 'AndroidManifest.xml'),  path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml'));
copy(path.join(SRC, 'strings.xml'),          path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml'));
copy(path.join(SRC, 'variables.gradle'),     path.join(ANDROID, 'variables.gradle'));
copy(path.join(SRC, 'project-build.gradle'), path.join(ANDROID, 'build.gradle'));

// Optional: drop google-services.json if provided as a CI secret file
const gs = path.join(ROOT, 'google-services.json');
if (fs.existsSync(gs)) {
  copy(gs, path.join(ANDROID, 'app', 'google-services.json'));
}

console.log('[patch] Android native config applied.');