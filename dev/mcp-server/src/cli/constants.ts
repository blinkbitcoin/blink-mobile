// App package info
export const APP_PACKAGE = "com.galoyapp";
export const APP_ACTIVITY = `${APP_PACKAGE}/.MainActivity`;

// Screen dimensions (assumed 1080x2400)
export const SCREEN = {
  width: 1080,
  height: 2400,
  centerX: 540,
  centerY: 1200,
};

// Swipe presets
export const SWIPES = {
  up: `shell input swipe ${SCREEN.centerX} 1800 ${SCREEN.centerX} 600 300`,
  down: `shell input swipe ${SCREEN.centerX} 600 ${SCREEN.centerX} 1800 300`,
  left: `shell input swipe 900 ${SCREEN.centerY} 180 ${SCREEN.centerY} 300`,
  right: `shell input swipe 180 ${SCREEN.centerY} 900 ${SCREEN.centerY} 300`,
};

// Timeouts (ms)
export const TIMEOUTS = {
  short: 2000,
  medium: 5000,
  long: 10000,
  captcha: 120000,
};

// Helper to exit with error
export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
