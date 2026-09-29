import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.translator.androidstrings',
  appName: 'XML Translator',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F8F9FA',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#1EB996',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F8F9FA',
    },
  },
};

export default config;
