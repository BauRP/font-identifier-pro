/**
 * Native camera + gallery acquisition with safe lifecycle.
 *
 * Critical bug fix (gallery → analyze → crash on Android 13+):
 *  - Camera and Gallery permission flows are fully separated. The gallery
 *    path NEVER touches the CAMERA permission, and the camera path NEVER
 *    touches the PHOTOS permission.
 *  - On native we capture as Base64 (CameraResultType.Base64). That removes
 *    every Scoped Storage hazard: the bytes are handed to JS once, and the
 *    ML Kit OCR plugin reads them directly — no content:// URI reopens, no
 *    FileProvider grants required after the picker closes.
 *  - Capture failures are re-thrown with a tag so the UI can distinguish
 *    them from a true permission denial.
 */

import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  CameraDirection,
} from '@capacitor/camera';

export type CaptureSource = 'camera' | 'gallery';

export interface CapturedImage {
  /** Webview-safe URL (use directly in <img src>). On native this is a data: URL. */
  displayUrl: string;
  /** Raw base64 payload (no data: prefix). Present on native captures. */
  base64?: string;
  /** MIME type, e.g. 'image/jpeg'. */
  mimeType?: string;
}

function isCancellation(err: unknown): boolean {
  const e = err as { message?: string; code?: string };
  const m = (e?.message || '').toLowerCase();
  return (
    m.includes('cancel') ||
    m.includes('cancelled') ||
    m.includes('canceled') ||
    m.includes('user denied') ||
    e?.code === 'USER_CANCELLED'
  );
}

/**
 * Request only the permission the chosen subsystem needs.
 * Android 14+ may return 'limited' for partial photo access — that counts as granted.
 * The modern Android photo picker doesn't actually require READ_MEDIA_IMAGES,
 * so a denied probe on the gallery path is non-fatal: we still attempt the picker.
 * Camera is hard-gated because there's no fallback.
 */
async function ensurePermission(source: CaptureSource): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const kind: 'camera' | 'photos' = source === 'camera' ? 'camera' : 'photos';
  try {
    const current = await Camera.checkPermissions();
    const state = current[kind];
    if (state === 'granted' || state === 'limited') return true;
    const req = await Camera.requestPermissions({ permissions: [kind] });
    const s = req[kind];
    if (s === 'granted' || s === 'limited') return true;
    if (source === 'gallery') return true;
    return false;
  } catch (err) {
    console.warn('[image-capture] permission probe failed', err);
    return source === 'gallery';
  }
}

export async function captureImage(source: CaptureSource): Promise<CapturedImage | null> {
  if (!Capacitor.isNativePlatform()) return webPickFile();

  const granted = await ensurePermission(source);
  if (!granted) return null;

  try {
    const photo = await Camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      saveToGallery: false,
      direction: CameraDirection.Rear,
      presentationStyle: 'fullscreen',
    });
    const base64 = photo.base64String;
    if (!base64) return null;
    const mimeType = `image/${photo.format || 'jpeg'}`;
    return {
      displayUrl: `data:${mimeType};base64,${base64}`,
      base64,
      mimeType,
    };
  } catch (err) {
    if (isCancellation(err)) return null;
    console.error('[image-capture] native capture failed', err);
    const wrapped = new Error(
      `${source}_capture_failed: ${(err as Error)?.message ?? 'unknown'}`,
    );
    (wrapped as Error & { source?: CaptureSource }).source = source;
    throw wrapped;
  }
}

function webPickFile(): Promise<CapturedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      resolve({ displayUrl: url });
    };
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve(null);
        window.removeEventListener('focus', onFocus);
      }, 800);
    };
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}