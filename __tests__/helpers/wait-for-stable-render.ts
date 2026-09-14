import { act } from "@testing-library/react-native"

type RenderedScreen = {
  toJSON: () => unknown
}

type RenderedNode = {
  type: string
  props?: Record<string, unknown>
  children?: Array<RenderedNode | string | number> | null
}

/**
 * A cheap fingerprint of everything a test can observe: element types, text,
 * and primitive props (testID, accessibility state, disabled...).
 *
 * Serializing the whole tree is not an option — rendered props hold navigation
 * objects, React contexts and circular back-references, which blow up both
 * `JSON.stringify` and `pretty-format`. Object- and function-valued props are
 * skipped on purpose: a callback that gets a new identity on every render is not
 * a change the test can see, and counting it would keep the tree "unstable"
 * forever.
 */
const describeNode = (
  node: RenderedNode | RenderedNode[] | string | number | null,
): string => {
  if (node === null || node === undefined) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(describeNode).join("")

  const props = Object.entries(node.props ?? {})
    .filter(([, value]) => value === null || typeof value !== "object")
    .filter(([, value]) => typeof value !== "function")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ` ${key}=${String(value)}`)
    .join("")

  const children = (node.children ?? []).map(describeNode).join("")

  return `<${node.type}${props}>${children}</${node.type}>`
}

const snapshot = (screen: RenderedScreen): string =>
  describeNode(screen.toJSON() as RenderedNode | RenderedNode[] | null)

type Options = {
  /** Identical consecutive snapshots required before the tree counts as settled. */
  stableFlushes?: number
  /** Upper bound on flushes, so a never-settling tree fails fast and loudly. */
  maxFlushes?: number
}

/**
 * One turn of the event loop inside `act()`, draining both the timer phase (a
 * pending `setTimeout(..., 0)`) and the check phase (`setImmediate`), so a tree
 * waiting on either one is not mistaken for a settled tree.
 */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  })
}

/**
 * Flush effects until the rendered tree stops changing, then let the test assert.
 *
 * `await waitFor(() => expect(getByTestId(x)).toBeTruthy())` only proves the
 * element exists. It says nothing about the effect chain behind it having
 * finished, so an assertion placed *after* such a wait reads whichever frame the
 * machine happened to be on — which is why those tests pass on a laptop and fail
 * on a loaded CI runner.
 *
 * `waitFor` on the asserted value itself fixes the common case. It does not help
 * when the value the test expects is also produced by an intermediate frame: a
 * screen that renders A → B → A settles on A, but `waitFor(A)` returns on the
 * first frame and never sees the flip. Waiting for the tree to go quiet does.
 * The same goes for asserting something is *absent* — every frame before it
 * arrives satisfies that.
 *
 * This composes with `waitFor`, it does not replace it. "Nothing changed over
 * the last few turns of the event loop" cannot distinguish a settled tree from
 * one still waiting on a slow response, so wait for the thing you need to be
 * there first, then settle, then assert:
 *
 *   const screen = render(<ContextForScreen>{...}</ContextForScreen>)
 *   await waitFor(() => expect(screen.getByTestId("row")).toBeTruthy())
 *   await waitForStableRender(screen)
 *   expect(screen.getByTestId("row").props.children).toContain("no-highlight")
 *
 * Prefer `flushEffects()` when a single flush is provably enough, and plain
 * `waitFor` on the value when no intermediate frame can carry it.
 */
export const waitForStableRender = async (
  screen: RenderedScreen,
  { stableFlushes = 3, maxFlushes = 25 }: Options = {},
): Promise<void> => {
  let previous = snapshot(screen)
  let identical = 0

  for (let attempt = 0; attempt < maxFlushes; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await flush()
    const current = snapshot(screen)

    if (current === previous) {
      identical += 1
      if (identical >= stableFlushes) return
    } else {
      identical = 0
      previous = current
    }
  }

  throw new Error(
    `waitForStableRender: the tree still changed after ${maxFlushes} flushes. ` +
      `Last rendered output:\n${previous}`,
  )
}
