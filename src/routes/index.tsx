import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CameraScanner } from '@/components/CameraScanner';
import { ResultsDrawer } from '@/components/ResultsDrawer';
import { loadFontIndex, searchFonts, getFontCount } from '@/lib/font-search';
import { addScanHistory, getScanHistory } from '@/lib/scan-history';
import type { SearchResult, ScanHistoryItem } from '@/lib/font-types';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: TrivoApp,
});

function TrivoApp() {
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [fontCount, setFontCount] = useState(0);
  const [indexReady, setIndexReady] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadFontIndex().then(() => {
      setFontCount(getFontCount());
      setIndexReady(true);
    });
    setHistory(getScanHistory());
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      if (!indexReady) return;
      // Extract words and try each
      const words = text.split(/[\s\n,;]+/).filter((w) => w.length >= 2);
      let allResults: SearchResult[] = [];

      // Try full text first
      allResults = searchFonts(text);

      // Try individual words if no results
      if (allResults.length === 0) {
        for (const word of words) {
          const res = searchFonts(word);
          allResults.push(...res);
          if (allResults.length >= 20) break;
        }
      }

      // Dedupe
      const seen = new Set<string>();
      allResults = allResults.filter((r) => {
        if (seen.has(r.entry.file_name)) return false;
        seen.add(r.entry.file_name);
        return true;
      });

      setResults(allResults);
      setQuery(text.substring(0, 50));
      setDrawerOpen(true);
      addScanHistory(text.substring(0, 50), allResults.length);
      setHistory(getScanHistory());
    },
    [indexReady],
  );

  const handleManualSearch = () => {
    if (manualQuery.trim().length >= 2) {
      handleSearch(manualQuery.trim());
    }
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 glass">
        <div>
          <h1 className="font-display text-lg tracking-[0.2em] text-neon text-glow">TRIVO</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Font Scanner
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-neon/10 hover:text-neon"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Camera area */}
      <div className="relative flex-1">
        <CameraScanner
          onTextDetected={handleSearch}
          isScanning={isScanning}
          onToggleScan={() => setIsScanning(!isScanning)}
        />

        {/* Manual search overlay */}
        <div className="absolute left-4 right-4 top-4 z-20">
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
            <svg className="h-4 w-4 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              placeholder="Поиск шрифта по названию..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <Button variant="neon" size="sm" onClick={handleManualSearch} disabled={!indexReady}>
              Найти
            </Button>
          </div>
        </div>

        {/* Scan toggle FAB */}
        <motion.button
          className={`absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full p-4 font-display text-xs uppercase tracking-widest transition-all ${
            isScanning
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-neon text-neon-foreground glow-neon-strong'
          }`}
          onClick={() => setIsScanning(!isScanning)}
          whileTap={{ scale: 0.95 }}
          animate={isScanning ? { boxShadow: ['0 0 20px oklch(0.6 0.24 27 / 0.5)', '0 0 40px oklch(0.6 0.24 27 / 0.3)', '0 0 20px oklch(0.6 0.24 27 / 0.5)'] } : {}}
          transition={isScanning ? { duration: 1.5, repeat: Infinity } : {}}
        >
          {isScanning ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* History panel */}
      {showHistory && (
        <motion.div
          className="absolute inset-x-0 top-16 z-30 mx-4 glass rounded-xl p-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-neon">
            История сканирований
          </h3>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Пока нет сканирований</p>
          ) : (
            <div className="space-y-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    handleSearch(item.text);
                    setShowHistory(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-neon/10"
                >
                  <span className="truncate">{item.text}</span>
                  <span className="ml-2 text-muted-foreground">{item.resultCount} рез.</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Results drawer */}
      <ResultsDrawer
        results={results}
        query={query}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
