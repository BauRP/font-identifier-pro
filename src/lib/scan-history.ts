import type { ScanHistoryItem } from './font-types';

const HISTORY_KEY = 'trivo_scan_history';
const MAX_HISTORY = 10;

export function getScanHistory(): ScanHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addScanHistory(text: string, resultCount: number): void {
  const history = getScanHistory();
  const item: ScanHistoryItem = {
    id: crypto.randomUUID(),
    text,
    timestamp: Date.now(),
    resultCount,
  };
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
