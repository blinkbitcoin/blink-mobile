/**
 * Mute (and capture) `console.error` for the current test without switching off
 * the act() regression guard.
 *
 * `jest.spyOn(console, "error").mockImplementation(...)` replaces the wrapper
 * that jest.setup-after-env.ts installs, so for the rest of that file React's
 * "An update to X inside a test was not wrapped in act(...)" warnings are
 * neither printed nor failed — the guard is off, silently. This helper swaps
 * only the *sink* underneath the wrapper, so the inspection stays in place.
 *
 *   const errors = silenceConsoleError()
 *   ...
 *   expect(errors).toHaveBeenCalledWith(expect.stringContaining("boom"))
 *
 * The returned mock receives exactly what `console.error` was called with, so
 * it is a drop-in for the spy in assertions. The sink is restored after every
 * test by the guard's own `afterEach` — no teardown needed here.
 */
export const silenceConsoleError = (): jest.Mock<void, unknown[]> => {
  const calls = jest.fn<void, unknown[]>()
  const setSink = (globalThis as Record<string, unknown>).__setConsoleErrorSink as
    | ((sink: (...args: unknown[]) => void) => void)
    | undefined

  if (!setSink) {
    throw new Error(
      "console.error guard is not installed — jest.setup-after-env.ts did not run.",
    )
  }

  setSink((...args: unknown[]) => {
    calls(...args)
  })
  return calls
}
