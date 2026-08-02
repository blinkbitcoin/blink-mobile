// Suppress known, non-actionable console.warn noise during tests so local and
// CI logs stay readable (originally CI-only, extended to local runs — the
// repeated noise drowned out real output; see issue #3813):
// - "InteractionManager has been deprecated": @react-navigation/* internals and
//   app/screens/transaction-history/transaction-history-screen.tsx
// - "SafeAreaView has been deprecated": react-native-country-picker-modal
// - "[ip-country-lookup] No API key configured": app/utils/ip-country-lookup.ts
//   warns at module load when no geo API key env vars are set, which is always
//   the case in the jest environment. The warning behavior itself is asserted
//   in __tests__/utils/ip-country-lookup.spec.ts via a local console.warn spy
//   (spies layer on top of this filter, so those assertions are unaffected).
//
// Anything not on this list still prints — new warnings stay visible. Before
// adding a pattern here, make sure the warning is either third-party noise we
// cannot fix or app behavior pinned by an explicit test assertion.
const SUPPRESSED_WARNINGS = [
  /InteractionManager has been deprecated/,
  /SafeAreaView has been deprecated/,
  /\[ip-country-lookup\] No API key configured/,
]

const originalWarn = console.warn.bind(console)
console.warn = (...args) => {
  const message = typeof args[0] === "string" ? args[0] : ""
  if (SUPPRESSED_WARNINGS.some((re) => re.test(message))) return
  originalWarn(...args)
}
