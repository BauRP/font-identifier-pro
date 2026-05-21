import { useEffect, useState, memo } from 'react';
import { Download, Share2, Type, Palette, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { injectFontFace, downloadFont, shareFont } from '@/lib/font-actions';
import type { SearchResult } from '@/lib/font-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface FontCardProps {
  result: SearchResult;
  rank: number;
  sampleText: string;
}

const SWATCHES = [
  '#ffffff', '#000000', '#f5f5f5', '#1a1a1a',
  '#39FF14', '#00E5FF', '#FF2D95', '#FFB800',
  '#7C5CFF', '#FF5C5C', '#1FB89A', '#D0A85C',
];

function ColorSwatch({
  value,
  onChange,
  icon,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border transition-transform hover:scale-105"
          style={{ background: value }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-foreground mix-blend-difference">
            {icon}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end" sideOffset={6}>
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`h-6 w-6 rounded border ${value === c ? 'border-neon ring-2 ring-neon/40' : 'border-border'}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="col-span-6 mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Свой:
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const FontCard = memo(function FontCard({ result, rank, sampleText }: FontCardProps) {
  const { entry } = result;
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [textColor, setTextColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#1a1a1a');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    setFontFamily(injectFontFace(entry));
  }, [entry]);

  const tier =
    rank === 1 ? 'Closest match' : rank <= 5 ? 'Very similar' : 'Similar';
  const tierClass =
    rank === 1
      ? 'bg-neon/20 text-neon border-neon/40'
      : rank <= 5
        ? 'bg-neon/10 text-neon/80 border-neon/20'
        : 'bg-secondary text-muted-foreground border-border';

  const handleDownload = async (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    let res;
    try {
      res = await downloadFont(entry);
    } catch (err) {
      res = { ok: false, error: (err as Error)?.message ?? 'unknown' };
    }
    setDownloading(false);
    if (res.ok) {
      setDownloaded(true);
      toast.success('Шрифт сохранён', {
        description: res.location?.includes('Download')
          ? 'Папка Downloads/TRIVO'
          : res.location?.includes('Documents')
            ? 'Папка Documents/TRIVO'
            : `${entry.file_name}`,
      });
      setTimeout(() => setDownloaded(false), 2400);
    } else {
      toast.error('Не удалось скачать', { description: res.error ?? 'Network error' });
    }
  };

  const handleShare = async (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    try {
      await shareFont(entry);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        rank === 1
          ? 'border-neon/40 bg-neon/[0.04] shadow-[0_0_24px_-12px_oklch(0.86_0.21_142/0.6)]'
          : 'border-border bg-card/40'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon/15 font-display text-[11px] text-neon">
            {rank}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm tracking-wide text-neon">
              {entry.full_name}
            </h3>
            <p className="truncate text-[10px] text-muted-foreground">{entry.family_name}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-display uppercase tracking-wider ${tierClass}`}
        >
          {tier}
        </span>
      </div>

      <div className="flex items-stretch gap-2">
        <div
          className="flex flex-1 items-center overflow-hidden rounded-lg px-3 py-3 text-base leading-tight"
          style={{
            background: bgColor,
            color: textColor,
            fontFamily: fontFamily || 'inherit',
          }}
        >
          <span className="line-clamp-2">{sampleText}</span>
        </div>

        <div className="flex flex-col items-center justify-between gap-1.5">
          <ColorSwatch
            value={textColor}
            onChange={setTextColor}
            icon={<Type className="h-3.5 w-3.5" />}
            label="Цвет текста"
          />
          <ColorSwatch
            value={bgColor}
            onChange={setBgColor}
            icon={<Palette className="h-3.5 w-3.5" />}
            label="Цвет фона"
          />
          <button
            onClick={handleShare}
            onTouchEnd={(e) => { e.stopPropagation(); }}
            aria-label="Поделиться"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-neon/10 hover:text-neon"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDownload}
            onTouchEnd={(e) => { e.stopPropagation(); }}
            disabled={downloading}
            aria-label="Скачать"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-neon text-neon-foreground glow-neon transition-shadow hover:glow-neon-strong disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : downloaded ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
