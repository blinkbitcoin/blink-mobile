const { format } = require("util") // eslint-disable-line @typescript-eslint/no-var-requires

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

// Non-actionable deprecation warnings emitted by third-party internals. They
// are dropped in CI so the logs stay readable, and still printed locally so
// developers see the deprecations; the console guard below allows them either
// way. See https://github.com/blinkbitcoin/blink-mobile/issues/3813
// - "InteractionManager has been deprecated": @react-navigation/* internals and
//   app/screens/transaction-history/transaction-history-screen.tsx
// - "SafeAreaView has been deprecated": react-native-country-picker-modal
const THIRD_PARTY_DEPRECATIONS = [
  /InteractionManager has been deprecated/,
  /SafeAreaView has been deprecated/,
]

const isCI = Boolean(process.env.CI) && process.env.CI !== "false"

const matchesAny = (patterns, args) => {
  const message = typeof args[0] === "string" ? args[0] : ""
  return patterns.some((re) => re.test(message))
}

// Console guard: a test run prints results and nothing else. Any console call a
// spec did not ask for fails the test it happened in, instead of piling up in
// the CI log until a real failure is hard to find (the output was cleaned up
// in #3822 and had grown back to ~4,600 lines a run five months later).
//
// - Expected output: spy on that console method with mockImplementation and
//   assert the call. The spy replaces the wrapper, so its calls never reach it.
// - A library logging something no app or spec change can fix: add it to one
//   of the lists above, with the reason.
// - Local debugging: JEST_ALLOW_CONSOLE=1 prints console calls as usual and
//   fails nothing. CI never sets it.
const CONSOLE_METHODS = ["error", "warn", "log", "info", "debug"]
const MAX_MESSAGE_LINES = 5
const MAX_APP_FRAMES = 3
const allowConsole = process.env.JEST_ALLOW_CONSOLE === "1"
const unexpectedConsoleCalls = []

const projectRoot = `${process.cwd()}/`

/** The first few project frames outside node_modules and this file: where the call came from. */
const callSite = () =>
  (new Error().stack ?? "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.includes(projectRoot) &&
        !line.includes("/node_modules/") &&
        !line.includes("jest.setup"),
    )
    .slice(0, MAX_APP_FRAMES)

CONSOLE_METHODS.forEach((method) => {
  const forward = console[method].bind(console)
  console[method] = (...args) => {
    if (matchesAny(TEST_ENVIRONMENT_ARTIFACTS, args)) return
    if (matchesAny(THIRD_PARTY_DEPRECATIONS, args)) {
      if (!isCI) forward(...args)
      return
    }
    if (allowConsole) {
      forward(...args)
      return
    }
    unexpectedConsoleCalls.push({
      method,
      test: expect.getState().currentTestName,
      message: format(...args),
      callSite: callSite(),
    })
  }
})

const describeCall = ({ method, test, message, callSite: frames }) => {
  const lines = message.split("\n")
  const shown = lines.slice(0, MAX_MESSAGE_LINES)
  if (lines.length > MAX_MESSAGE_LINES) {
    shown.push(`… ${lines.length - MAX_MESSAGE_LINES} more lines`)
  }
  // Neither kind of line may start with "at ": Jest would lift it out as a stack frame.
  return [
    `console.${method} ${test ? `in "${test}"` : "while the spec file loaded"}:`,
    ...shown.map((line) => `  | ${line}`),
    ...frames.map(
      (frame) => `  from ${frame.replace(/^at /, "").replace(projectRoot, "")}`,
    ),
  ].join("\n")
}

const failOnUnexpectedConsole = () => {
  if (unexpectedConsoleCalls.length === 0) return
  const calls = unexpectedConsoleCalls.splice(0)
  const error = new Error(
    [
      `Unexpected console output (${calls.length} call${calls.length === 1 ? "" : "s"}).`,
      "Fix the source, or if the output is expected, spy on that console method with",
      "mockImplementation and assert the call. See jest.setup.js for library noise.",
      "",
      ...calls.map(describeCall),
    ].join("\n"),
  )
  // Point the stack at the first offending call rather than at this hook, so Jest's code
  // frame shows the console call itself (it needs the absolute path to find the source).
  error.stack = [error.message, calls[0].callSite[0] ?? ""].join("\n    ")
  throw error
}

afterEach(failOnUnexpectedConsole)
// Catches calls made after the last test's afterEach, e.g. from a leaked timer
// or promise settling during teardown.
afterAll(failOnUnexpectedConsole)
