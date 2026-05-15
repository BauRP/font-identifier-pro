import type { FontEntry } from './font-types';
import { getFontUrl, getFontDownloadUrl } from './font-types';

export async function shareFont(entry: FontEntry): Promise<void> {
  const url = getFontDownloadUrl(entry);
  const text = `Нашел шрифт "${entry.full_name}" в TRIVO Font Scanner. Ссылка на скачивание: ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Шрифт: ${entry.full_name}`, text, url });
      return;
    } catch {
      // User cancelled or error — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // silent
  }
}

export function getTelegramShareUrl(entry: FontEntry): string {
  const url = getFontDownloadUrl(entry);
  const text = `Нашел шрифт "${entry.full_name}" в TRIVO Font Scanner.`;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function getWhatsAppShareUrl(entry: FontEntry): string {
  const url = getFontDownloadUrl(entry);
  const text = `Нашел шрифт "${entry.full_name}" в TRIVO Font Scanner. ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function downloadFont(entry: FontEntry): Promise<void> {
  const url = getFontUrl(entry);
  const { saveFontFile, platform } = await import('./permissions');

  // Native (Android): fetch the font and write to /Documents/TRIVO/ via scoped storage
  // (no WRITE_EXTERNAL_STORAGE needed on SDK 30+).
  if (platform.isNative()) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await saveFontFile(entry.file_name, blob);
      return;
    } catch {
      // fall through to web download
    }
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = entry.file_name;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Dynamic @font-face injection
const loadedFonts = new Set<string>();

export function injectFontFace(entry: FontEntry): string {
  const fontFamily = `trivo-${entry.file_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
  if (loadedFonts.has(fontFamily)) return fontFamily;

  const url = getFontUrl(entry);
  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: "${fontFamily}"; src: url("${url}") format("truetype"); font-display: swap; }`;
  document.head.appendChild(style);
  loadedFonts.add(fontFamily);
  return fontFamily;
}
