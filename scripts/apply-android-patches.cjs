#!/usr/bin/env node
/**
 * FontScan Elite — Android patcher.
 * Принудительно очищает проект от остатков Яндекса и накладывает чистый конфиг.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'scripts', 'native-config');
const ANDROID = path.join(ROOT, 'android');

if (!fs.existsSync(ANDROID)) {
  console.warn('[patch] android/ not present yet — skipping.');
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

// 1. Копируем основные файлы конфигурации (уже без Яндекса)
copy(path.join(SRC, 'build.gradle'),         path.join(ANDROID, 'app', 'build.gradle'));
copy(path.join(SRC, 'AndroidManifest.xml'),  path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml'));
copy(path.join(SRC, 'strings.xml'),          path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml'));
copy(path.join(SRC, 'variables.gradle'),     path.join(ANDROID, 'variables.gradle'));
copy(path.join(SRC, 'project-build.gradle'), path.join(ANDROID, 'build.gradle'));

// 2. КРИТИЧЕСКИЙ ШАГ: Очистка MainActivity.java
// Путь куда Capacitor создает файл при генерации
const targetMainActivity = path.join(ANDROID, 'app', 'src', 'main', 'java', 'com', 'trivo', 'app', 'MainActivity.java');
const sourceMainActivity = path.join(SRC, 'MainActivity.java');

if (fs.existsSync(sourceMainActivity)) {
    fs.mkdirSync(path.dirname(targetMainActivity), { recursive: true });
    fs.copyFileSync(sourceMainActivity, targetMainActivity);
    console.log('✅ [patch] MainActivity.java принудительно очищен от Яндекса');
} else {
    console.error('❌ [patch] Ошибка: Не найден исходный файл MainActivity.java в scripts/native-config/');
}

// 3. Работа с Google Services (если есть)
const gs = path.join(ROOT, 'google-services.json');
if (fs.existsSync(gs)) {
  copy(gs, path.join(ANDROID, 'app', 'google-services.json'));
}

console.log('[patch] Android native config applied. SYSTEM CLEAN.');
