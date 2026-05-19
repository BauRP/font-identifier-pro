/**
 * Cross-platform text recognition.
 * Native (Android/iOS): on-device Google ML Kit (and Apple Vision via the plugin's iOS implementation).
 * Web preview: tesseract.js fallback so the same flow works in the browser.
 *
 * Returns word/line-level bounding boxes in *image* coordinate space (pixels of the source image),
 * so the UI overlay can scale them precisely to any displayed size.
 */

import { Capacitor } from '@capacitor/core';

export interface TextBlock {
  id: string;
  text: string;
  /** Bounding box in image pixel coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecognitionResult {
  fullText: string;
  blocks: TextBlock[];
  imageWidth: number;
  imageHeight: number;
}

async function loadImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

async function imageSrcToBase64(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
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

async function recognizeNative(displayUrl: string): Promise<RecognitionResult> {
  const { CapacitorPluginMlKitTextRecognition } = await import(
    '@pantrist/capacitor-plugin-ml-kit-text-recognition'
  );
  const base64Image = await imageSrcToBase64(displayUrl);
  const { w, h } = await loadImageSize(displayUrl);
  const res = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image, rotation: 0 });

  const blocks: TextBlock[] = [];
  let i = 0;
  for (const block of res.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const bb = line.boundingBox;
      if (!bb || !line.text?.trim()) continue;
      blocks.push({
        id: `b${i++}`,
        text: line.text.trim(),
        x: bb.left,
        y: bb.top,
        width: bb.right - bb.left,
        height: bb.bottom - bb.top,
      });
    }
  }
  return { fullText: res.text ?? '', blocks, imageWidth: w, imageHeight: h };
}

async function recognizeWeb(displayUrl: string): Promise<RecognitionResult> {
  const Tesseract = await import('tesseract.js');
  const { w, h } = await loadImageSize(displayUrl);
  const worker = await Tesseract.createWorker('eng+rus');
  try {
    const { data } = await worker.recognize(displayUrl, {}, { blocks: true });
    const blocks: TextBlock[] = [];
    let i = 0;
    const pageBlocks = (data as { blocks?: Array<{ lines?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }).blocks ?? [];
    for (const block of pageBlocks) {
      for (const line of block.lines ?? []) {
        const text = (line.text || '').trim();
        if (!text) continue;
        const bb = line.bbox;
        blocks.push({
          id: `b${i++}`,
          text,
          x: bb.x0,
          y: bb.y0,
          width: bb.x1 - bb.x0,
          height: bb.y1 - bb.y0,
        });
      }
    }
    return { fullText: data.text ?? '', blocks, imageWidth: w, imageHeight: h };
  } finally {
    await worker.terminate();
  }
}

/** Run on-device OCR on a web-safe image URL (returned by image-capture). */
export async function recognizeTextFromImage(displayUrl: string): Promise<RecognitionResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await recognizeNative(displayUrl);
    } catch (err) {
      console.error('[text-recognition] native ML Kit failed, falling back to tesseract', err);
    }
  }
  return recognizeWeb(displayUrl);
}

/** Crop a region of the source image as a data URL — used for the results-drawer preview. */
export async function cropImageRegion(
  displayUrl: string,
  block: TextBlock,
  padding = 8,
): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = displayUrl;
    });
    const x = Math.max(0, block.x - padding);
    const y = Math.max(0, block.y - padding);
    const w = Math.min(img.naturalWidth - x, block.width + padding * 2);
    const h = Math.min(img.naturalHeight - y, block.height + padding * 2);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
