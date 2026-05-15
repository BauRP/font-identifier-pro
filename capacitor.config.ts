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
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
