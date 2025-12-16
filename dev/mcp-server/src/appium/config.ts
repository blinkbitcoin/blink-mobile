export interface AppiumConfig {
  host: string;
  port: number;
  deviceName: string;
  appPath: string;
  appPackage: string;
}

export function getConfig(): AppiumConfig {
  return {
    host: process.env.APPIUM_HOST || "127.0.0.1",
    port: parseInt(process.env.APPIUM_PORT || "4723", 10),
    deviceName: process.env.TEST_DEVICE_ANDROID || "emulator-5554",
    appPath:
      process.env.TEST_APK_PATH ||
      "./android/app/build/outputs/apk/debug/app-universal-debug.apk",
    appPackage: "io.galoy.bitcoinbeach",
  };
}
