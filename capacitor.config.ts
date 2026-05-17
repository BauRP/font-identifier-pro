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
    webContentsDebuggingEnabled: true,
  },
  server: {
    // Возвращаем родную нативную схему Capacitor
    androidScheme: 'capacitor',
  },
  plugins: {
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
