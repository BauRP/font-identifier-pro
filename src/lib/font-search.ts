import type { FontEntry, SearchResult } from './font-types';
import { loadDriveMapping } from './font-types';
import FlexSearch from 'flexsearch';

const assetUrl = (path: string) => new URL(path, window.location.href).toString();

let fontIndex: FontEntry[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
// FlexSearch document index — optimized for the ~147k-entry catalog
let flex: any = null;

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
    // Build FlexSearch document index (forward tokenizer = fastest for prefix lookups)
    flex = new FlexSearch.Document({
      tokenize: 'forward',
      cache: 100,
      document: {
        id: 'file_name',
        index: ['full_name', 'family_name'],
      },
    });
    for (let i = 0; i < fontIndex.length; i++) {
      flex.add(fontIndex[i]);
    }
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
  const seen = new Set<string>();

  // FlexSearch result shape: [{ field, result: [id, ...] }]
  const hits: Array<{ field: string; result: string[] }> = flex
    ? (flex.search(q, { limit: 50, suggest: true }) ?? [])
    : [];

  const lookup = new Map<string, FontEntry>();
  for (let i = 0; i < fontIndex.length; i++) lookup.set(fontIndex[i].file_name, fontIndex[i]);

  for (const group of hits) {
    for (const id of group.result) {
      if (seen.has(id)) continue;
      seen.add(id);
      const entry = lookup.get(id);
      if (!entry) continue;
      const isExact =
        entry.full_name.toLowerCase() === q || entry.family_name.toLowerCase() === q;
      (isExact ? exact : close).push({ entry, score: isExact ? 'exact' : 'close' });
    }
  }

  return [...exact.slice(0, 10), ...close.slice(0, 20)];
}

export function getFontCount(): number {
  return fontIndex.length;
}
