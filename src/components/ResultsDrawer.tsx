import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { SearchResult } from '@/lib/font-types';
import { FontCard } from './FontCard';

interface ResultsDrawerProps {
  results: SearchResult[];
  query: string;
  /** Cropped region from the source photo (data URL or blob URL). */
  cropImage?: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Re-run the font search with user-corrected text. */
  onQueryChange?: (text: string) => void;
}

/**
 * Phase D — results overlay:
 *   • Top:    cropped piece of the original image
 *   • Bottom: exactly 10 ranked font candidates
 *     #1     = closest match
 *     #2-#5  = very similar
 *     #6-#10 = similar with noticeable differences
 */
export function ResultsDrawer({
  results,
  query,
  cropImage,
  isOpen,
  onClose,
  onQueryChange,
}: ResultsDrawerProps) {
  const top10 = results.slice(0, 10);
  const sample = (query || 'The Quick Brown Fox').slice(0, 64);
  const [editText, setEditText] = useState(query);
  useEffect(() => { setEditText(query); }, [query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[1000] bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-[1001] flex max-h-[92dvh] h-[92dvh] flex-col glass rounded-t-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex shrink-0 justify-center py-2">
              <div className="h-1 w-12 rounded-full bg-neon/40" />
            </div>

            {/* Header: cropped image preview */}
            <div className="shrink-0 px-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base tracking-wider text-neon text-glow">
                    Похожие шрифты
                  </h2>
                  <p className="truncate text-[11px] text-muted-foreground">
                    «{sample}» — {top10.length} из {results.length}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                  aria-label="Закрыть"
                  className="relative z-[1002] flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-neon/10 hover:text-neon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Editable extracted-text input — lets user correct OCR mistakes */}
              {onQueryChange && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-neon/20 bg-black/30 px-2 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-neon" />
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editText.trim().length >= 2) {
                        onQueryChange(editText.trim());
                      }
                    }}
                    placeholder="Исправьте распознанный текст..."
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editText.trim().length >= 2) onQueryChange(editText.trim());
                    }}
                    className="rounded bg-neon/20 px-2 py-0.5 text-[10px] font-display uppercase tracking-wider text-neon hover:bg-neon/30"
                  >
                    Найти
                  </button>
                </div>
              )}

              <div className="mt-2 overflow-hidden rounded-xl border border-neon/20 bg-black">
                {cropImage ? (
                  <img
                    src={cropImage}
                    alt="Распознанная область"
                    className="h-24 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-20 items-center justify-center px-4">
                    <p className="line-clamp-2 text-center font-display text-lg text-neon/90">
                      {sample}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ranked list */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6"
              style={{
                WebkitOverflowScrolling: 'touch',
                pointerEvents: 'auto',
                touchAction: 'pan-y',
              }}
            >
              {top10.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="font-display text-sm text-muted-foreground">
                    Шрифты не найдены
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {top10.map((r, i) => (
                    <FontCard
                      key={`${r.entry.file_name}-${i}`}
                      result={r}
                      rank={i + 1}
                      sampleText={sample}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
