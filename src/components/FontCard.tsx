import { useEffect, useState, memo } from 'react';
import { injectFontFace, downloadFont, shareFont, getTelegramShareUrl, getWhatsAppShareUrl } from '@/lib/font-actions';
import type { SearchResult } from '@/lib/font-types';
import { Button } from '@/components/ui/button';

interface FontCardProps {
  result: SearchResult;
}

export const FontCard = memo(function FontCard({ result }: FontCardProps) {
  const { entry, score } = result;
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const ff = injectFontFace(entry);
    setFontFamily(ff);
  }, [entry]);

  const handleShare = async () => {
    await shareFont(entry);
  };

  return (
    <div className="glass rounded-xl p-4 transition-all hover:glow-neon">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm tracking-wide text-neon">{entry.full_name}</h3>
          <p className="text-xs text-muted-foreground">{entry.family_name}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-display uppercase tracking-wider ${
          score === 'exact'
            ? 'bg-neon/20 text-neon border border-neon/30'
            : 'bg-secondary text-muted-foreground border border-border'
        }`}>
          {score === 'exact' ? 'Точное' : 'Похожее'}
        </span>
      </div>

      {/* Font preview */}
      <div
        className="mb-3 rounded-lg bg-surface p-3 text-lg text-surface-foreground"
        style={{ fontFamily: fontFamily || 'inherit' }}
      >
        Быстрая лиса прыгает — The Quick Brown Fox
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="neon"
          size="sm"
          className="flex-1"
          onClick={() => downloadFont(entry)}
        >
          ⬇ Скачать
        </Button>
        <Button
          variant="neonOutline"
          size="sm"
          className="flex-1"
          onClick={() => setShowShare(!showShare)}
        >
          ↗ Поделиться
        </Button>
      </div>

      {/* Share links */}
      {showShare && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="glass" size="sm" onClick={handleShare}>
            📤 Системный экспорт
          </Button>
          <a
            href={getTelegramShareUrl(entry)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs glass text-foreground hover:bg-neon/10 transition-colors"
          >
            ✈️ Telegram
          </a>
          <a
            href={getWhatsAppShareUrl(entry)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs glass text-foreground hover:bg-neon/10 transition-colors"
          >
            💬 WhatsApp
          </a>
        </div>
      )}
    </div>
  );
});
