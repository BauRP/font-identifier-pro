import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraDirection,
  CameraErrorCode,
  MediaTypeSelection,
  type MediaResult,
} from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

interface CameraScannerProps {
  onTextDetected: (text: string) => void;
  isScanning: boolean;
  onToggleScan: () => void;
}

const VF_X = 0.1;
const VF_Y = 0.25;
const VF_W = 0.8;
const VF_H = 0.3;

const FONTSCAN_API_URL =
  import.meta.env.VITE_FONTSCAN_API_URL ??
  "https://project--cb1967de-aa1b-4a89-aab8-185d0f94235a-dev.lovable.app/api/public/fontscan";

type NativeCaptureSource = "camera" | "gallery";

function isCancellation(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === CameraErrorCode.TakePhotoCancelled ||
    candidate.message?.toLowerCase().includes("cancel")
  );
}

export function CameraScanner({ onTextDetected, isScanning }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState<string>("Готов к сканированию");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerRef = useRef<any>(null);

  const sendBlobToFontScanCloud = useCallback(async (blob: Blob) => {
    const form = new FormData();
    form.append("image", blob, `fontscan-${Date.now()}.jpg`);

    const response = await fetch(FONTSCAN_API_URL, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error(`FontScan Cloud API failed: ${response.status}`);
    }

    const data = (await response.json()) as { text?: string };
    return data.text?.trim() ?? "";
  }, []);

  const recognizeImage = useCallback(
    async (imageSource: string, imageBlob?: Blob) => {
      try {
        let text = "";

        if (imageBlob) {
          setStatus("Отправка в FontScan Cloud...");
          text = await sendBlobToFontScanCloud(imageBlob);
        }

        if (!text) {
          if (!workerRef.current) {
            const Tesseract = await import("tesseract.js");
            workerRef.current = await Tesseract.createWorker("kaz+rus+eng");
          }
          const { data } = await workerRef.current.recognize(imageSource);
          text = data.text.trim();
        }

        if (text.length >= 2) {
          onTextDetected(text);
          setStatus(`Распознано: "${text.substring(0, 30)}..."`);
        } else {
          setStatus("Текст не найден на изображении");
        }
      } catch (error) {
        console.error("OCR recognition failed", error);
        setStatus("Ошибка распознавания");
      }
    },
    [onTextDetected, sendBlobToFontScanCloud],
  );

  const executeNativeCapture = useCallback(
    async (source: NativeCaptureSource) => {
      if (!Capacitor.isNativePlatform()) {
        return null;
      }

      try {
        setPermissionDenied(false);
        setStatus(source === "camera" ? "Запрос доступа к камере..." : "Запрос доступа к галерее...");

        const permissionScope = source === "camera" ? ["camera" as const] : ["photos" as const];
        const permissions = await Camera.requestPermissions({ permissions: permissionScope });
        const granted = source === "camera" ? permissions.camera === "granted" : permissions.photos === "granted" || permissions.photos === "limited";

        if (!granted) {
          setPermissionDenied(true);
          setStatus(source === "camera" ? "Нет доступа к камере" : "Нет доступа к галерее");
          return null;
        }

        setStatus(source === "camera" ? "Открываю камеру..." : "Открываю галерею...");

        const media: MediaResult | undefined =
          source === "camera"
            ? await Camera.takePhoto({
                quality: 90,
                editable: "no",
                cameraDirection: CameraDirection.Rear,
                targetWidth: 1600,
                targetHeight: 1600,
                correctOrientation: true,
              })
            : (await Camera.chooseFromGallery({
                mediaType: MediaTypeSelection.Photo,
                allowMultipleSelection: false,
                quality: 90,
                targetWidth: 1600,
                targetHeight: 1600,
                correctOrientation: true,
                editable: "no",
              })).results[0];

        const imageUrl = media?.webPath ?? media?.uri;
        if (!imageUrl) {
          setStatus(source === "camera" ? "Съёмка отменена" : "Изображение не выбрано");
          return null;
        }

        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();
        return { imageUrl, imageBlob };
      } catch (error) {
        if (isCancellation(error)) {
          setStatus(source === "camera" ? "Съёмка отменена" : "Изображение не выбрано");
          return null;
        }
        console.error("Native camera/gallery action failed", error);
        setPermissionDenied(true);
        setStatus(source === "camera" ? "Ошибка запуска камеры" : "Ошибка запуска галереи");
        return null;
      }
    },
    [],
  );

  const startCamera = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const result = await executeNativeCapture("camera");
      if (!result) return;
      setStatus("Распознавание изображения...");
      await recognizeImage(result.imageUrl, result.imageBlob);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setPermissionDenied(false);
        setStatus("Камера активна");
      }
    } catch (error) {
      console.error("Web camera start failed", error);
      setPermissionDenied(true);
      setStatus("Нет доступа к камере");
    }
  }, [executeNativeCapture, recognizeImage]);

  const importFromGallery = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const result = await executeNativeCapture("gallery");
      if (!result) return;
      setStatus("Распознавание изображения...");
      await recognizeImage(result.imageUrl, result.imageBlob);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        setStatus("Изображение не выбрано");
        return;
      }
      const url = URL.createObjectURL(file);
      setStatus("Распознавание изображения...");
      await recognizeImage(url, file);
      URL.revokeObjectURL(url);
    };
    input.click();
  }, [executeNativeCapture, recognizeImage]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  }, []);

  const captureViewfinderFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = Math.round(vw * VF_X);
    const sy = Math.round(vh * VF_Y);
    const sw = Math.round(vw * VF_W);
    const sh = Math.round(vh * VF_H);

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/png");
  }, []);

  useEffect(() => {
    if (!isScanning || !cameraActive) {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      return;
    }

    let isBusy = false;

    const doScan = async () => {
      if (isBusy) return;
      isBusy = true;
      setStatus("Сканирование...");

      try {
        const frame = captureViewfinderFrame();
        if (!frame) {
          isBusy = false;
          return;
        }
        await recognizeImage(frame);
      } catch {
        setStatus("Ошибка распознавания");
      }
      isBusy = false;
    };

    doScan();
    scanIntervalRef.current = setInterval(doScan, 1500);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isScanning, cameraActive, captureViewfinderFrame, recognizeImage]);

  useEffect(() => {
    return () => {
      stopCamera();
      workerRef.current?.terminate();
    };
  }, [stopCamera]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence>
        {isScanning && cameraActive && (
          <motion.div
            className="scan-line pointer-events-none absolute inset-x-0 h-32"
            initial={{ top: "-8rem" }}
            animate={{ top: ["-8rem", "calc(100% + 8rem)"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </AnimatePresence>

      {cameraActive && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-neon glow-neon"
          style={{ left: `${VF_X * 100}%`, top: `${VF_Y * 100}%`, width: `${VF_W * 100}%`, height: `${VF_H * 100}%` }}
        >
          <div className="absolute -left-0.5 -top-0.5 h-4 w-4 border-l-2 border-t-2 border-neon glow-neon" />
          <div className="absolute -right-0.5 -top-0.5 h-4 w-4 border-r-2 border-t-2 border-neon glow-neon" />
          <div className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-2 border-l-2 border-neon glow-neon" />
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-2 border-r-2 border-neon glow-neon" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-6 w-px bg-neon/40" />
            <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-neon/40" />
          </div>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-display uppercase tracking-widest text-neon/70">
            Зона сканирования
          </span>
        </div>
      )}

      {cameraActive && (
        <div
          className="pointer-events-none absolute inset-0 bg-background/40"
          style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${VF_X * 100}% ${VF_Y * 100}%, ${VF_X * 100}% ${(VF_Y + VF_H) * 100}%, ${(VF_X + VF_W) * 100}% ${(VF_Y + VF_H) * 100}%, ${(VF_X + VF_W) * 100}% ${VF_Y * 100}%, ${VF_X * 100}% ${VF_Y * 100}%)` }}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 glass px-4 py-3">
        <p className="text-center font-display text-sm tracking-wide text-neon">{status}</p>
      </div>

      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background">
          <motion.div
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-neon glow-neon-strong"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg className="h-10 w-10 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </motion.div>
          <div className="px-6 text-center">
            <h2 className="font-display text-xl tracking-wider text-neon text-glow">TRIVO SCANNER</h2>
            <p className="mt-2 text-sm text-muted-foreground">Наведите камеру на текст для распознавания шрифта</p>
            <div className="mt-4 rounded-lg border border-neon/20 bg-neon/5 px-4 py-3 text-xs text-muted-foreground">
              <p className="mb-1 font-display text-[10px] uppercase tracking-wider text-neon/80">Зачем нужна камера?</p>
              <p>Приложение использует камеру только для распознавания текста на фото. Изображения не сохраняются на устройстве.</p>
            </div>
            {permissionDenied && <p className="mt-3 text-xs text-destructive">Доступ запрещён. Разрешите доступ в системных настройках Android.</p>}
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={startCamera} className="rounded-lg bg-neon px-8 py-3 font-display text-sm uppercase tracking-widest text-neon-foreground glow-neon-strong transition-shadow hover:glow-neon-strong">
              Запустить камеру
            </button>
            <button onClick={importFromGallery} className="rounded-lg border border-neon/30 px-6 py-2 font-display text-xs uppercase tracking-widest text-neon/80 transition-colors hover:bg-neon/10">
              Выбрать из галереи
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
