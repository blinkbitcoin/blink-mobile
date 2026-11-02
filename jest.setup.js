// Warnings that only exist because the code runs under Jest, filtered in every
// environment because no change to app code or a spec can make them go away:
// - "animatedRef is not initialized in useScrollOffset": Reanimated 4.3.1's
//   useAnimatedRef().observe() reads findNodeHandle(ref), which is always null
//   under react-test-renderer, so useScrollOffset.ts:112 warns for every
//   correct useScrollViewOffset (app/components/map-component/place-sheet.tsx).
//   Re-check on a Reanimated bump.
const TEST_ENVIRONMENT_ARTIFACTS = [
  /^\[Reanimated\] animatedRef is not initialized in useScrollOffset/,
]

// In CI, suppress noisy, non-actionable deprecation warnings emitted during
// tests by third-party internals, so Concourse/CI logs stay readable:
// - "InteractionManager has been deprecated": @react-navigation/* internals and
//   app/screens/transaction-history/transaction-history-screen.tsx
// - "SafeAreaView has been deprecated": react-native-country-picker-modal
// Locally the warnings are left intact so developers still see the deprecations.
// See https://github.com/blinkbitcoin/blink-mobile/issues/3813
const CI_SUPPRESSED_DEPRECATIONS = [
  /InteractionManager has been deprecated/,
  /SafeAreaView has been deprecated/,
]

const isCI = Boolean(process.env.CI) && process.env.CI !== "false"

const SUPPRESSED_WARNINGS = [
  ...TEST_ENVIRONMENT_ARTIFACTS,
  ...(isCI ? CI_SUPPRESSED_DEPRECATIONS : []),
]

const originalWarn = console.warn.bind(console)
console.warn = (...args) => {
  const message = typeof args[0] === "string" ? args[0] : ""
  if (SUPPRESSED_WARNINGS.some((re) => re.test(message))) return
  originalWarn(...args)
}
