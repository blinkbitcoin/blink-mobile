// Suppress known, non-actionable console.warn noise during tests so local and
// CI logs stay readable (originally CI-only, extended to local runs — the
// repeated noise drowned out real output; see issue #3813):
// - "InteractionManager has been deprecated": @react-navigation/* internals and
//   app/screens/transaction-history/transaction-history-screen.tsx
// - "SafeAreaView has been deprecated": react-native-country-picker-modal
//
// Both are third-party deprecations we cannot act on. Anything not on this list
// still prints — new warnings stay visible. This list is for third-party noise
// only: a warning our own code emits belongs fixed at the source, not hidden
// here, because hiding it also hides the regression that would make it fire for
// a real reason (app/utils/ip-country-lookup.ts was on this list until its
// warning moved off module load and onto the first actual lookup).
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
