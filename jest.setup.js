// In CI, suppress the noisy, non-actionable "InteractionManager has been deprecated"
// warning emitted during tests by @react-navigation/* internals and by
// app/screens/transaction-history/transaction-history-screen.tsx, so Concourse/CI
// logs stay readable. Locally the warning is left intact so developers still see
// the deprecation. See https://github.com/blinkbitcoin/blink-mobile/issues/3813
const isCI = Boolean(process.env.CI) && process.env.CI !== "false"

if (isCI) {
  const SUPPRESSED_WARNINGS = [/InteractionManager has been deprecated/]
  const originalWarn = console.warn.bind(console)
  console.warn = (...args) => {
    const message = typeof args[0] === "string" ? args[0] : ""
    if (SUPPRESSED_WARNINGS.some((re) => re.test(message))) return
    originalWarn(...args)
  }
}
