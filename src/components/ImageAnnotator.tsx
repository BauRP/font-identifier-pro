import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import type { RecognitionResult, TextBlock } from '@/lib/text-recognition';

interface Props {
  imageUrl: string;
  recognition: RecognitionResult | null;
  isAnalyzing: boolean;
  selectedBlockId: string | null;
  onBlockSelect: (block: TextBlock) => void;
  onClose: () => void;
}

/**
 * Renders the captured image with an SVG overlay of red clickable bounding boxes,
 * perfectly scaled to the displayed image regardless of device DPR / resolution.
 */
export function ImageAnnotator({
  imageUrl,
  recognition,
  isAnalyzing,
  selectedBlockId,
  onBlockSelect,
  onClose,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const el = imgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [imageUrl]);

  const naturalW = recognition?.imageWidth ?? 0;
  const naturalH = recognition?.imageHeight ?? 0;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <header className="z-10 flex items-center justify-between px-4 py-3 glass">
        <div>
          <h2 className="font-display text-sm tracking-widest text-neon text-glow">
            ВЫБЕРИТЕ ОБЛАСТЬ
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isAnalyzing
              ? 'Распознавание текста...'
              : `Найдено областей: ${recognition?.blocks.length ?? 0}`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-neon/10 hover:text-neon"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-auto">
        <div className="relative">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Снимок"
            className="block max-h-[calc(100dvh-7rem)] max-w-full select-none object-contain"
            onLoad={(e) => {
              const r = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
              setBox({ w: r.width, h: r.height });
            }}
          />

          {box && recognition && naturalW > 0 && naturalH > 0 && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${naturalW} ${naturalH}`}
              preserveAspectRatio="none"
              style={{ width: box.w, height: box.h }}
            >
              {recognition.blocks.map((b) => {
                const selected = b.id === selectedBlockId;
                return (
                  <g key={b.id} className="pointer-events-auto cursor-pointer">
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      height={b.height}
                      fill={selected ? 'rgba(255, 45, 45, 0.30)' : 'rgba(255, 45, 45, 0.10)'}
                      stroke={selected ? '#39FF14' : '#FF2D2D'}
                      strokeWidth={Math.max(2, naturalW / 360)}
                      onClick={() => onBlockSelect(b)}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {isAnalyzing && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-neon/30 bg-background/80 px-4 py-2 text-neon">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-display text-xs uppercase tracking-widest">
                  Анализ на устройстве…
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <footer className="z-10 px-4 py-3 glass">
        <p className="text-center text-[11px] text-muted-foreground">
          Нажмите на красную область, чтобы подобрать шрифт
        </p>
      </footer>
    </div>
  );
}
