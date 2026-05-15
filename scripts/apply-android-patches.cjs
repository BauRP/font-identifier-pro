#!/usr/bin/env node
/**
 * FontScan Elite — Android patcher.
 * Очистка от Яндекса и настройка API 36.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'scripts', 'native-config');
const ANDROID = path.join(ROOT, 'android');

if (!fs.existsSync(ANDROID)) {
  console.warn('⚠️ [patch] android/ еще не создан. Пропускаю.');
  process.exit(0);
}

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ [patch] Внимание: Файл ${src} не найден. Пропускаю.`);
    return;
  }
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ [patch] Записан: ${path.relative(ROOT, dest)}`);
  } catch (err) {
    console.error(`❌ [patch] Ошибка при копировании ${src}:`, err);
  }
}

// 1. Копируем конфиги
copy(path.join(SRC, 'build.gradle'),         path.join(ANDROID, 'app', 'build.gradle'));
copy(path.join(SRC, 'AndroidManifest.xml'),  path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml'));
copy(path.join(SRC, 'strings.xml'),          path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml'));
copy(path.join(SRC, 'variables.gradle'),     path.join(ANDROID, 'variables.gradle'));
copy(path.join(SRC, 'project-build.gradle'), path.join(ANDROID, 'build.gradle'));

// 2. Очистка MainActivity.java (Удаление остатков Яндекса)
const targetMainActivity = path.join(ANDROID, 'app', 'src', 'main', 'java', 'com', 'trivo', 'app', 'MainActivity.java');
const sourceMainActivity = path.join(SRC, 'MainActivity.java');

copy(sourceMainActivity, targetMainActivity);

// 3. Перенос google-services.json из корня в папку приложения
const gs = path.join(ROOT, 'google-services.json');
if (fs.existsSync(gs)) {
  copy(gs, path.join(ANDROID, 'app', 'google-services.json'));
}

console.log('[patch] Android native config applied. Чистая сборка готова.');
