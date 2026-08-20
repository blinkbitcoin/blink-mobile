import React from "react"
import { Text, View } from "react-native"
import { render, waitFor } from "@testing-library/react-native"

import { waitForStableRender } from "./wait-for-stable-render"

/**
 * Renders "A", flips to "B" on the next timer turn, then back to "A" — the
 * A -> B -> A shape that makes `waitFor` on the final value return too early.
 */
const Flipper = ({ flips }: { flips: number }) => {
  const [value, setValue] = React.useState("A")
  const [done, setDone] = React.useState(0)

  React.useEffect(() => {
    if (done >= flips) return undefined

    const timer = setTimeout(() => {
      setValue((current) => (current === "A" ? "B" : "A"))
      setDone((current) => current + 1)
    }, 0)

    return () => clearTimeout(timer)
  }, [done, flips])

  return (
    <View>
      <Text testID="value">{value}</Text>
      <Text testID="flips-done">{String(done)}</Text>
    </View>
  )
}

/**
 * Never stops re-rendering, but its structure and text never change — only the
 * callback identity handed to the child does. That is the churn the snapshot
 * deliberately ignores; counting it would make this tree "unstable" forever.
 */
const ChurningCallback = () => {
  const [renders, setRenders] = React.useState(0)

  React.useEffect(() => {
    const timer = setTimeout(() => setRenders((current) => current + 1), 0)
    return () => clearTimeout(timer)
  }, [renders])

  return (
    <View>
      <Text testID="value" onPress={() => undefined}>
        A
      </Text>
    </View>
  )
}

/** Changes nothing but a primitive prop, which the snapshot does track. */
const PropFlipper = () => {
  const [disabled, setDisabled] = React.useState(true)

  React.useEffect(() => {
    if (!disabled) return undefined

    const timer = setTimeout(() => setDisabled(false), 0)
    return () => clearTimeout(timer)
  }, [disabled])

  return (
    <View>
      <Text testID="value" accessibilityState={{ disabled }} disabled={disabled}>
        A
      </Text>
    </View>
  )
}

describe("waitForStableRender", () => {
  it("returns only once the tree has stopped changing", async () => {
    const screen = render(<Flipper flips={2} />)

    await waitForStableRender(screen)

    expect(screen.getByTestId("value").props.children).toBe("A")
    expect(screen.getByTestId("flips-done").props.children).toBe("2")
  })

  it("waits past an intermediate frame that carries the expected value", async () => {
    const screen = render(<Flipper flips={2} />)

    // The trap this helper exists for: the settled value is also the value of
    // the very first frame, so `waitFor` on it returns before the flip and the
    // assertion that follows races the rest of the chain.
    await waitFor(() => {
      expect(screen.getByTestId("value").props.children).toBe("A")
    })
    // Returned mid-chain: the flips are not done, so anything asserted here is
    // read off an unsettled tree.
    expect(Number(screen.getByTestId("flips-done").props.children)).toBeLessThan(2)

    await waitForStableRender(screen)

    expect(screen.getByTestId("value").props.children).toBe("A")
    expect(screen.getByTestId("flips-done").props.children).toBe("2")
  })

  it("does not count a re-rendered callback identity as a change", async () => {
    const screen = render(<ChurningCallback />)

    await expect(waitForStableRender(screen, { maxFlushes: 6 })).resolves.toBeUndefined()
  })

  it("waits for a primitive prop to settle", async () => {
    const screen = render(<PropFlipper />)

    await waitForStableRender(screen)

    expect(screen.getByTestId("value").props.disabled).toBe(false)
  })

  it("throws instead of hanging when the tree never settles", async () => {
    const screen = render(<Flipper flips={Number.POSITIVE_INFINITY} />)

    await expect(waitForStableRender(screen, { maxFlushes: 6 })).rejects.toThrow(
      "still changed after 6 flushes",
    )

    screen.unmount()
  })
})
