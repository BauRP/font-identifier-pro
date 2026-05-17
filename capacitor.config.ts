import type { CapacitorConfig } from '@capacitor/cli';

type CapacitorConfigWithLegacyRuntimeFlag = CapacitorConfig & {
  bundledWebRuntime?: false;
};

const config: CapacitorConfigWithLegacyRuntimeFlag = {
  appId: 'com.trivo.app',
  appName: 'TRIVO Font Scanner',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true, // На будущее для отладки
  },
  server: {
    // Используем классическую http схему и хост для стабильной маршрутизации ассетов
    androidScheme: 'http',
    hostname: 'localhost',
  },
  plugins: {
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
