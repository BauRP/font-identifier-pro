export interface FontEntry {
  file_name: string;
  family_name: string;
  full_name: string;
  path: string;
}

export interface SearchResult {
  entry: FontEntry;
  score: 'exact' | 'close';
}

export interface ScanHistoryItem {
  id: string;
  text: string;
  timestamp: number;
  resultCount: number;
}

// Drive mapping: file_name → Google Drive file ID
let driveMapping: Record<string, string> = {};
let driveMappingLoaded = false;
let driveMappingPromise: Promise<void> | null = null;

const assetUrl = (path: string) => new URL(path, window.location.href).toString();

export async function loadDriveMapping(): Promise<void> {
  if (driveMappingLoaded) return;
  if (driveMappingPromise) { await driveMappingPromise; return; }

  driveMappingPromise = fetch(assetUrl('drive_mapping.json'))
    .then((res) => res.json())
    .then((data: Record<string, string>) => {
      driveMapping = data;
      driveMappingLoaded = true;
    });

  await driveMappingPromise;
}

export function getDriveFileId(fileName: string): string | null {
  return driveMapping[fileName] ?? null;
}

export function getFontUrl(entry: FontEntry): string {
  const fileId = getDriveFileId(entry.file_name);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  // Fallback to GCS placeholder (shouldn't happen with full mapping)
  const cleanPath = entry.path.replace(/\\\\/g, '/').replace(/\\/g, '/').replace(/^source_fonts\//, '');
  return `https://storage.googleapis.com/trivo-fonts/${encodeURIComponent(cleanPath)}`;
}

export function getFontDownloadUrl(entry: FontEntry): string {
  return getFontUrl(entry);
}
