// In CI, suppress noisy, non-actionable deprecation warnings emitted during
// tests by third-party internals, so Concourse/CI logs stay readable:
// - "InteractionManager has been deprecated": @react-navigation/* internals and
//   app/screens/transaction-history/transaction-history-screen.tsx
// - "SafeAreaView has been deprecated": react-native-country-picker-modal
// Locally the warnings are left intact so developers still see the deprecations.
// See https://github.com/blinkbitcoin/blink-mobile/issues/3813
const isCI = Boolean(process.env.CI) && process.env.CI !== "false"

if (isCI) {
  const SUPPRESSED_WARNINGS = [
    /InteractionManager has been deprecated/,
    /SafeAreaView has been deprecated/,
  ]
  const originalWarn = console.warn.bind(console)
  console.warn = (...args) => {
    const message = typeof args[0] === "string" ? args[0] : ""
    if (SUPPRESSED_WARNINGS.some((re) => re.test(message))) return
    originalWarn(...args)
  }
}

// `requestIdleCallback` is installed by React Native's InitializeCore at runtime,
// which the jest preset does not run, so the global is missing here. Scheduling
// straight away is the honest stand-in: a test has no frames to yield to, and
// the alternative is production code carrying a guard for a global that always
// exists on device.
if (typeof global.requestIdleCallback !== "function") {
  global.requestIdleCallback = (callback) => setTimeout(() => callback(), 0)
  global.cancelIdleCallback = (handle) => clearTimeout(handle)
}
