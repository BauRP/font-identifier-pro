import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CameraScanner } from '@/components/CameraScanner';
import { ImageAnnotator } from '@/components/ImageAnnotator';
import { ResultsDrawer } from '@/components/ResultsDrawer';
import { loadFontIndex, searchFonts, getFontCount } from '@/lib/font-search';
import { addScanHistory, getScanHistory } from '@/lib/scan-history';
import type { FontEntry, SearchResult, ScanHistoryItem } from '@/lib/font-types';
import { Button } from '@/components/ui/button';
import { captureImage } from '@/lib/image-capture';
import {
  recognizeTextFromImage,
  cropImageRegion,
  type RecognitionResult,
  type TextBlock,
} from '@/lib/text-recognition';

export const Route = createFileRoute('/')({
  component: TrivoApp,
});

function TrivoApp() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [fontCount, setFontCount] = useState(0);
  const [indexReady, setIndexReady] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [allFonts, setAllFonts] = useState<FontEntry[]>([]);

  // Image acquisition / recognition state
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Готов к сканированию');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);

  useEffect(() => {
    loadFontIndex().then((index) => {
      setAllFonts(index);
      setFontCount(getFontCount());
      setIndexReady(true);
    });
    setHistory(getScanHistory());
  }, []);

  const runSearch = useCallback(
    (text: string) => {
      if (!indexReady) return;
      const words = text.split(/[\s\n,;]+/).filter((w) => w.length >= 2);
      let allResults: SearchResult[] = searchFonts(text);
      if (allResults.length === 0) {
        for (const word of words) {
          allResults.push(...searchFonts(word));
          if (allResults.length >= 20) break;
        }
      }
      const seen = new Set<string>();
      allResults = allResults.filter((r) => {
        if (seen.has(r.entry.file_name)) return false;
        seen.add(r.entry.file_name);
        return true;
      });
      if (allResults.length < 10 && allFonts.length > 0) {
        while (allResults.length < 10) {
          const pick = allFonts[Math.floor(Math.random() * allFonts.length)];
          if (!pick || seen.has(pick.file_name)) continue;
          seen.add(pick.file_name);
          allResults.push({ entry: pick, score: 'close' });
        }
      } else {
        allResults = allResults.slice(0, 10);
      }
      setResults(allResults);
      setQuery(text.substring(0, 64));
      setDrawerOpen(true);
      addScanHistory(text.substring(0, 50), allResults.length);
      setHistory(getScanHistory());
    },
    [indexReady, allFonts],
  );

  const handleManualSearch = () => {
    if (manualQuery.trim().length >= 2) {
      setCropImage(null);
      runSearch(manualQuery.trim());
    }
  };

  const handleCapture = useCallback(
    async (source: 'camera' | 'gallery') => {
      if (busy) return;
      setBusy(true);
      setPermissionDenied(false);
      setStatus(source === 'camera' ? 'Открываю камеру...' : 'Открываю галерею...');
      try {
        const captured = await captureImage(source);
        if (!captured) {
          setStatus('Отменено');
          setBusy(false);
          return;
        }
        setImageUrl(captured.displayUrl);
        setAnalyzing(true);
        setRecognition(null);
        setSelectedBlockId(null);
        setStatus('Анализ на устройстве (ML Kit / Vision)...');
        const rec = await recognizeTextFromImage(captured.displayUrl);
        setRecognition(rec);
        setAnalyzing(false);
        setStatus(
          rec.blocks.length > 0
            ? `Найдено ${rec.blocks.length} областей. Нажмите красный блок.`
            : 'Текст не найден. Попробуйте другое фото.',
        );
      } catch (err) {
        console.error('[index] capture flow failed', err);
        setPermissionDenied(true);
        setStatus('Ошибка доступа к камере');
        setImageUrl(null);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleBlockSelect = useCallback(
    async (block: TextBlock) => {
      setSelectedBlockId(block.id);
      if (imageUrl) {
        const crop = await cropImageRegion(imageUrl, block);
        setCropImage(crop);
      }
      runSearch(block.text);
    },
    [imageUrl, runSearch],
  );

  const closeAnnotator = () => {
    setImageUrl(null);
    setRecognition(null);
    setSelectedBlockId(null);
    setAnalyzing(false);
    setStatus('Готов к сканированию');
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="relative z-30 flex items-center justify-between px-4 py-3 glass">
        <div>
          <h1 className="font-display text-lg tracking-[0.2em] text-neon text-glow">TRIVO</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Font Scanner · {fontCount > 0 ? `${fontCount} fonts` : 'loading'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-neon/10 hover:text-neon"
            aria-label="История"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="relative flex-1">
        <CameraScanner
          onCapture={handleCapture}
          busy={busy || analyzing}
          status={status}
          permissionDenied={permissionDenied}
        />

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
      </div>

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
                    runSearch(item.text);
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

      {imageUrl && (
        <ImageAnnotator
          imageUrl={imageUrl}
          recognition={recognition}
          isAnalyzing={analyzing}
          selectedBlockId={selectedBlockId}
          onBlockSelect={handleBlockSelect}
          onClose={closeAnnotator}
        />
      )}

      <ResultsDrawer
        results={results}
        query={query}
        cropImage={cropImage}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
