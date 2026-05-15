import type { FontEntry, SearchResult } from './font-types';
import { loadDriveMapping } from './font-types';

const assetUrl = (path: string) => new URL(path, window.location.href).toString();

let fontIndex: FontEntry[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadFontIndex(): Promise<FontEntry[]> {
  if (isLoaded) return fontIndex;
  if (loadPromise) {
    await loadPromise;
    return fontIndex;
  }

  loadPromise = Promise.all([
    fetch(assetUrl('font_index.json')).then((res) => res.json()),
    loadDriveMapping(),
  ]).then(([data]) => {
    fontIndex = data;
    isLoaded = true;
  });

  await loadPromise;
  return fontIndex;
}

export function searchFonts(query: string): SearchResult[] {
  if (!query || query.length < 2 || !isLoaded) return [];

  const q = query.toLowerCase().trim();
  const exact: SearchResult[] = [];
  const close: SearchResult[] = [];

  for (let i = 0; i < fontIndex.length; i++) {
    const entry = fontIndex[i];
    const fullLower = entry.full_name.toLowerCase();
    const familyLower = entry.family_name.toLowerCase();

    if (fullLower === q || familyLower === q) {
      exact.push({ entry, score: 'exact' });
    } else if (fullLower.includes(q) || familyLower.includes(q)) {
      close.push({ entry, score: 'close' });
    }

    // Cap results for performance
    if (exact.length + close.length >= 50) break;
  }

  return [...exact.slice(0, 10), ...close.slice(0, 20)];
}

export function getFontCount(): number {
  return fontIndex.length;
}
