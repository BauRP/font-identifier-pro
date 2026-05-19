import { motion } from 'framer-motion';
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';

interface CameraScannerProps {
  onCapture: (source: 'camera' | 'gallery') => void;
  busy: boolean;
  status: string;
  permissionDenied: boolean;
}

/**
 * Idle landing surface. Image acquisition itself is delegated to
 * src/lib/image-capture.ts so this component stays a pure presentation layer.
 */
export function CameraScanner({ onCapture, busy, status, permissionDenied }: CameraScannerProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-background px-6">
      <motion.div
        className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-neon glow-neon-strong"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <CameraIcon className="h-12 w-12 text-neon" />
      </motion.div>

      <div className="text-center">
        <h2 className="font-display text-xl tracking-wider text-neon text-glow">
          TRIVO SCANNER
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Сфотографируйте надпись или выберите фото из галереи. Распознавание выполняется
          локально на устройстве (Android ML Kit / Apple Vision).
        </p>
        <div className="mt-4 rounded-lg border border-neon/20 bg-neon/5 px-4 py-3 text-xs text-muted-foreground">
          <p className="mb-1 font-display text-[10px] uppercase tracking-wider text-neon/80">
            On-device AI
          </p>
          <p>Изображения никуда не загружаются — анализ происходит полностью офлайн.</p>
        </div>
        {permissionDenied && (
          <p className="mt-3 text-xs text-destructive">
            Доступ запрещён. Разрешите доступ в системных настройках.
          </p>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
        <button
          disabled={busy}
          onClick={() => onCapture('camera')}
          className="flex items-center justify-center gap-2 rounded-lg bg-neon px-6 py-3 font-display text-sm uppercase tracking-widest text-neon-foreground glow-neon-strong transition-opacity disabled:opacity-60"
        >
          <CameraIcon className="h-4 w-4" />
          Камера
        </button>
        <button
          disabled={busy}
          onClick={() => onCapture('gallery')}
          className="flex items-center justify-center gap-2 rounded-lg border border-neon/30 px-6 py-3 font-display text-xs uppercase tracking-widest text-neon/90 transition-colors hover:bg-neon/10 disabled:opacity-60"
        >
          <ImageIcon className="h-4 w-4" />
          Из галереи
        </button>
      </div>

      <p className="absolute bottom-3 left-0 right-0 text-center font-display text-[11px] tracking-wide text-neon/80">
        {status}
      </p>
    </div>
  );
}
