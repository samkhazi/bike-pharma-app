import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bikesurgeon.customer",
  appName: "Bike Surgeon",
  webDir: "dist",
  backgroundColor: "#ffffff",
  ios: {
    contentInset: "never",
    scrollEnabled: false,
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
