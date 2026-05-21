/**
 * Font-row actions: native share + native download to the device's Downloads folder.
 */
import { Capacitor } from '@capacitor/core';
import type { FontEntry } from './font-types';
import { getFontUrl, getFontDownloadUrl } from './font-types';

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

export async function shareFont(entry: FontEntry): Promise<void> {
  const url = getFontDownloadUrl(entry);
  const title = `Шрифт: ${entry.full_name}`;
  const text = `Нашёл шрифт "${entry.full_name}" в TRIVO Font Scanner.`;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      const can = await Share.canShare();
      if (can.value) {
        await Share.share({ title, text, url, dialogTitle: 'Поделиться шрифтом' });
        return;
      }
    } catch (err) {
      const m = (err as { message?: string })?.message?.toLowerCase() || '';
      if (m.includes('cancel')) return;
      console.warn('[share] native share failed, falling back to web', err);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // fall through
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* silent */
  }
}

interface DownloadResult {
  ok: boolean;
  location?: string;
  error?: string;
}

export async function downloadFont(entry: FontEntry): Promise<DownloadResult> {
  const url = getFontUrl(entry);

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const fileName = entry.file_name;

      // Native downloadFile bypasses WebView CORS entirely.
      const targets: Array<{ path: string; directory: Directory }> = [
        { path: `Download/TRIVO/${fileName}`, directory: Directory.ExternalStorage },
        { path: `TRIVO/${fileName}`, directory: Directory.Documents },
        { path: `TRIVO/${fileName}`, directory: Directory.Cache },
      ];
      let lastErr: unknown = null;
      for (const t of targets) {
        try {
          const dl = await Filesystem.downloadFile({
            url,
            path: t.path,
            directory: t.directory,
            recursive: true,
          } as Parameters<typeof Filesystem.downloadFile>[0]);
          return { ok: true, location: (dl as { path?: string }).path ?? t.path };
        } catch (err) {
          lastErr = err;
          console.warn('[download] target failed', t, err);
        }
      }
      // Final fallback: fetch + writeFile (may fail under CORS but worth trying).
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const base64 = await blobToBase64(blob);
        const written = await Filesystem.writeFile({
          path: `TRIVO/${fileName}`,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        return { ok: true, location: written.uri };
      } catch (err) {
        lastErr = err;
      }
      return { ok: false, error: (lastErr as Error)?.message ?? 'download failed' };
    } catch (err) {
      return { ok: false, error: (err as Error)?.message ?? 'download failed' };
    }
  }

  // Web fallback: trigger browser download
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.file_name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, location: 'browser' };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? 'download failed' };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function getTelegramShareUrl(entry: FontEntry): string {
  const url = getFontDownloadUrl(entry);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Шрифт ${entry.full_name}`)}`;
}
export function getWhatsAppShareUrl(entry: FontEntry): string {
  const url = getFontDownloadUrl(entry);
  return `https://wa.me/?text=${encodeURIComponent(`Шрифт ${entry.full_name} ${url}`)}`;
}
