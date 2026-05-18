import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { SearchResult } from '@/lib/font-types';
import { FontCard } from './FontCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResultsDrawerProps {
  results: SearchResult[];
  query: string;
  /** Cropped region from the source photo (data URL or blob URL). */
  cropImage?: string | null;
  isOpen: boolean;
  onClose: () => void;
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
}: ResultsDrawerProps) {
  const top10 = results.slice(0, 10);
  const sample = (query || 'The Quick Brown Fox').slice(0, 64);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col glass rounded-t-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
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
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-neon/10 hover:text-neon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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
            <ScrollArea className="flex-1 px-4 pb-6">
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
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
