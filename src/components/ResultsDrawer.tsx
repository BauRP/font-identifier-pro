import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '@/lib/font-types';
import { FontCard } from './FontCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResultsDrawerProps {
  results: SearchResult[];
  query: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ResultsDrawer({ results, query, isOpen, onClose }: ResultsDrawerProps) {
  const exact = results.filter((r) => r.score === 'exact');
  const close = results.filter((r) => r.score === 'close');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] glass rounded-t-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="h-1 w-12 rounded-full bg-neon/40" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3">
              <h2 className="font-display text-lg tracking-wider text-neon text-glow">
                Результаты
              </h2>
              <p className="text-xs text-muted-foreground">
                Запрос: «{query}» — найдено {results.length} шрифтов
              </p>
            </div>

            <ScrollArea className="max-h-[70vh] px-4 pb-6">
              {exact.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-neon/70">
                    Точные совпадения ({exact.length})
                  </h3>
                  <div className="space-y-3">
                    {exact.map((r) => (
                      <FontCard key={r.entry.file_name} result={r} />
                    ))}
                  </div>
                </div>
              )}

              {close.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-neon/70">
                    Похожие ({close.length})
                  </h3>
                  <div className="space-y-3">
                    {close.map((r) => (
                      <FontCard key={r.entry.file_name} result={r} />
                    ))}
                  </div>
                </div>
              )}

              {results.length === 0 && (
                <div className="py-12 text-center">
                  <p className="font-display text-sm text-muted-foreground">Шрифты не найдены</p>
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
