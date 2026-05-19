/**
 * Native camera + gallery acquisition with safe lifecycle.
 *
 * Fixes the "freeze after permissions granted" bug by:
 *  - Always awaiting the permission request before getPhoto
 *  - Returning a Capacitor.convertFileSrc()-converted webview-safe URL
 *  - Returning null on cancellation so the caller can clear loading state
 *  - Swallowing native lifecycle errors instead of throwing into React
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
  /** Webview-safe URL (use directly in <img src>) */
  displayUrl: string;
  /** Original native path (file:// or content://) — kept for debugging only */
  nativePath?: string;
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

async function ensurePermission(source: CaptureSource): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const kind = source === 'camera' ? 'camera' : 'photos';
    const current = await Camera.checkPermissions();
    const state = current[kind];
    if (state === 'granted' || state === 'limited') return true;
    const req = await Camera.requestPermissions({ permissions: [kind] });
    const s = req[kind];
    return s === 'granted' || s === 'limited';
  } catch (err) {
    console.error('[image-capture] permission failure', err);
    return false;
  }
}

export async function captureImage(source: CaptureSource): Promise<CapturedImage | null> {
  // Web fallback for the preview iframe
  if (!Capacitor.isNativePlatform()) {
    if (source === 'camera') {
      // No real camera in the preview iframe — fall back to file picker
      return webPickFile();
    }
    return webPickFile();
  }

  const granted = await ensurePermission(source);
  if (!granted) return null;

  try {
    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      saveToGallery: false,
      direction: CameraDirection.Rear,
      presentationStyle: 'fullscreen',
    });

    // photo.path is file:// (Android FileProvider URI) — webPath is already convertFileSrc-ready
    // but we force conversion to be safe across Capacitor versions.
    const raw = photo.webPath || photo.path;
    if (!raw) return null;
    const displayUrl = Capacitor.convertFileSrc(raw);
    return { displayUrl, nativePath: photo.path };
  } catch (err) {
    if (isCancellation(err)) return null;
    console.error('[image-capture] native capture failed', err);
    return null;
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
    // If the user closes the picker without choosing, the change event never fires.
    // We resolve null after a long timeout via window focus.
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
