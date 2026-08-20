import { format } from "util"

// Shared per-test setup/teardown (registered via setupFilesAfterEnv in jest.config.js).
//
// In CI, retry flaky tests at test granularity instead of re-running the whole
// job (issue #3815). Every failed attempt is still logged, so flakes stay
// visible in the CI output instead of being silently absorbed. Local runs stay
// strict: a genuinely broken test fails fast without retries.
if (process.env.CI) {
  jest.retryTimes(2, { logErrorsBeforeRetry: true })
}

//
// Drain the microtask queue after every test so leftover promise jobs
// (e.g. un-awaited .then chains from Apollo mutations/queries) settle before
// the next test's render(). Without this, async work leaking past a test
// boundary can unmount/poison the shared test renderer and cascade into
// "Can't access .root on unmounted test renderer" failures in the NEXT test
// (see issue #3815).
//
// Deliberately minimal:
// - Promise.resolve() jobs are NOT affected by jest fake timers, so this is
//   safe in fake-timer suites (a setImmediate/setTimeout-based flush would
//   hang there).
// - No jest.useRealTimers() here: suites that enable fake timers at module
//   scope rely on them persisting across their tests.
// - No cleanup()/unmount here: RNTL's auto-cleanup already owns that.
//
// Each `await Promise.resolve()` yields one microtask turn, advancing any
// suspended async work by one step (one `.then` link / one `await`). The
// deepest leftover chain diagnosed in #3815 (Promise.all -> .then ->
// refetchQueries) settles in ~3 turns; 5 adds margin while staying
// constant-time. Bump if a longer leaked chain ever surfaces.
const MICROTASK_DRAIN_TURNS = 5

afterEach(async () => {
  for (let i = 0; i < MICROTASK_DRAIN_TURNS; i += 1) {
    await Promise.resolve()
  }
})

// Leaked-timer janitor: track real timers created during each test and clear
// any still pending at the test/file boundary.
//
// Why: a fast synchronous suite that renders a navigator (e.g. via the shared
// ContextForScreen helper) can finish before a leaked real timer fires; under
// --runInBand that timer then fires in a LATER suite, after this file's
// environment is torn down, throwing "You are trying to `import` a file after
// the Jest environment has been torn down" inside a timer callback — which
// crashes the whole Jest process. The "random suite, random run" CI failure
// from issue #3815. The original trigger (a JS-stack Card setTimeout,
// react-navigation#12401) is gone after the native-stack migration, but this
// janitor is kept as a general safety net since such leaks live in node_modules
// and can't be fixed at the source in app code.
//
// Fake-timer suites are unaffected: jest.useFakeTimers() shadows these
// wrappers entirely, and sinon restores them on useRealTimers().
const realSetTimeout = globalThis.setTimeout
const realSetInterval = globalThis.setInterval
// Opaque handles: the runtime value is what matters; lib typings disagree
// (DOM says number, Node says Timeout) so we don't pin a type here.
const liveTimers = new Set<unknown>()

globalThis.setTimeout = Object.assign(
  ((...args: Parameters<typeof globalThis.setTimeout>) => {
    const handle = realSetTimeout(...args)
    liveTimers.add(handle)
    return handle
  }) as typeof globalThis.setTimeout,
  realSetTimeout,
)

globalThis.setInterval = Object.assign(
  ((...args: Parameters<typeof globalThis.setInterval>) => {
    const handle = realSetInterval(...args)
    liveTimers.add(handle)
    return handle
  }) as typeof globalThis.setInterval,
  realSetInterval,
)

const clearLiveTimers = () => {
  liveTimers.forEach((handle) => {
    clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>)
    clearInterval(handle as ReturnType<typeof globalThis.setInterval>)
  })
  liveTimers.clear()
}

// Per-test sweep keeps timers from one test out of the next; the afterAll
// sweep runs after every other hook (incl. RNTL auto-cleanup, whose unmount
// can itself schedule timers) and is what prevents the cross-file crash.
afterEach(clearLiveTimers)
afterAll(() => {
  // Restore real timers before the final sweep: in fake-timer suites the
  // global clearTimeout is sinon's, which silently no-ops on the REAL handles
  // tracked above (timers scheduled at module-import time, before the suite's
  // jest.useFakeTimers() ran) — leaving them to fire after teardown. Safe at
  // file end (no test relies on fake timers persisting past afterAll, unlike
  // in the afterEach above) and a no-op when fake timers were never installed.
  jest.useRealTimers()
  clearLiveTimers()
})

// --- act() regression guard ---------------------------------------------
//
// React logs "An update to X inside a test was not wrapped in act(...)" through
// console.error whenever a state update lands after the test body returned.
// Each one marks a real race: the assertions ran against a tree that was still
// changing. Left as warnings they scroll past, and the suite drifts back into
// noise (this happened after #3820), so they fail the test instead.
//
// Fixing one: await the render rather than silencing the warning — `await
// waitFor(...)` / `await findBy*` for state you can assert on, or
// `await flushEffects()` (__tests__/helpers/flush-effects.ts) for a
// render-and-assert test whose effects settle on their own. If the update comes
// from a provider the shared wrapper mounts, fix it at the wrapper — patching
// spec by spec is whack-a-mole, since which suites trip is timing-dependent.
//
// The message is recorded here and thrown from a hook rather than thrown inline:
// console.error runs inside React's commit phase, where throwing corrupts the
// render and reports something unrelated.
const escapedActUpdates: string[] = []
const originalConsoleError = console.error.bind(console)

console.error = (...args: unknown[]) => {
  const template = typeof args[0] === "string" ? args[0] : ""
  if (template.includes("was not wrapped in act(")) {
    // React names the component through a %s placeholder, so the template has
    // to be formatted before it reads as anything useful. Keep the first line
    // only; the full React stack still goes to stderr below.
    const formatted = format(...(args as [string, ...unknown[]]))
    escapedActUpdates.push(formatted.split("\n")[0].trim())
  }
  originalConsoleError(...(args as Parameters<typeof console.error>))
}

const failOnEscapedActUpdates = () => {
  if (escapedActUpdates.length === 0) return
  const total = escapedActUpdates.length
  const seen = [...new Set(escapedActUpdates)]
  escapedActUpdates.length = 0
  throw new Error(
    `${total} state update(s) escaped act():\n` +
      `${seen.map((line) => `  - ${line}`).join("\n")}\n\n` +
      `Await the render instead of letting it settle after the test body — see ` +
      `__tests__/helpers/flush-effects.ts. Full React stacks are above.`,
  )
}

// Registered last so it runs after the microtask drain above (jest-circus runs
// afterEach hooks in registration order). RNTL registers its own cleanup when a
// spec imports it — i.e. after this file — so unmount-time warnings land after
// this hook has run; afterAll catches those.
afterEach(failOnEscapedActUpdates)
afterAll(failOnEscapedActUpdates)
