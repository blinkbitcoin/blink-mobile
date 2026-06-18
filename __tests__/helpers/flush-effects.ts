import { act } from "@testing-library/react-native"

/**
 * Settle pending promises/microtasks inside `act()` after a synchronous render.
 *
 * Providers and hooks commonly kick off async work in `useEffect` (KeyStore
 * reads, SDK init, session-profile lookups) whose `setState` resolves *after*
 * the synchronous test body returns — outside `act()` — producing
 * "An update to X inside a test was not wrapped in act(...)" warnings that flood
 * the CI logs. Awaiting this after such a render lets those updates flush within
 * `act()`, so the warnings disappear without masking genuine ones.
 *
 * Use it in synchronous render-and-assert tests that render a component/hook
 * with async effects:
 *
 *   const { result } = renderHook(() => useThing(), { wrapper })
 *   await flushEffects()
 *   expect(result.current.value).toBe(...)
 *
 * Tests that already await `waitFor`/`findBy*` on the resolved state do not need
 * this — the awaited query already settles the effects inside `act()`.
 */
export const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  })
}
