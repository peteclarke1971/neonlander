import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.peteclarke.neonlander',
  appName: 'NeonLander',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
