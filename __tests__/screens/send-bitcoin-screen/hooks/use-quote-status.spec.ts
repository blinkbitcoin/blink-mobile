import { act, renderHook } from "@testing-library/react-native"

import { useQuoteStatus } from "@app/screens/send-bitcoin-screen/hooks/use-quote-status"

const renderWithKey = (initialKey: string | null) =>
  renderHook(({ inputsKey }: { inputsKey: string | null }) => useQuoteStatus(inputsKey), {
    initialProps: { inputsKey: initialKey },
  })

describe("useQuoteStatus", () => {
  it("reports nothing to quote when the inputs are incomplete", () => {
    const { result } = renderWithKey(null)

    expect(result.current.hasQuote).toBe(false)
    expect(result.current.hasFailed).toBe(false)
    expect(result.current.isQuoting).toBe(false)
  })

  it("is quoting from the render the inputs complete, before any request runs", () => {
    const { result, rerender } = renderWithKey(null)

    rerender({ inputsKey: "wallet|address|1000" })

    expect(result.current.isQuoting).toBe(true)
    expect(result.current.hasQuote).toBe(false)
  })

  it("holds a quote once one is marked for the current inputs", () => {
    const { result } = renderWithKey("wallet|address|1000")

    act(() => result.current.markQuoted())

    expect(result.current.hasQuote).toBe(true)
    expect(result.current.isQuoting).toBe(false)
  })

  it("holds a failure once one is marked for the current inputs", () => {
    const { result } = renderWithKey("wallet|address|1000")

    act(() => result.current.markFailed())

    expect(result.current.hasFailed).toBe(true)
    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(false)
  })

  it("drops the quote on the very render the inputs change", () => {
    const { result, rerender } = renderWithKey("wallet|address|1000")

    act(() => result.current.markQuoted())
    rerender({ inputsKey: "wallet|address|9999" })

    // Read before any request for the new inputs runs: the fee on hand is the old one's.
    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })

  it("drops a failure on the very render the inputs change", () => {
    const { result, rerender } = renderWithKey("wallet|address|1000")

    act(() => result.current.markFailed())
    rerender({ inputsKey: "wallet|address|9999" })

    expect(result.current.hasFailed).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })

  it("ignores an outcome marked for inputs that have since changed", () => {
    const { result, rerender } = renderWithKey("wallet|address|1000")

    // Captured while the old inputs were current, as an in-flight request's closure would.
    const markStaleQuote = result.current.markQuoted
    rerender({ inputsKey: "wallet|address|9999" })
    act(() => markStaleQuote())

    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })

  it("clears a failure when a retry over unchanged inputs goes out", () => {
    const { result } = renderWithKey("recommended-fees")

    act(() => result.current.markFailed())
    act(() => result.current.discardQuote())

    expect(result.current.hasFailed).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })

  it("retires a failure when a later quote lands for the same inputs", () => {
    const { result } = renderWithKey("recommended-fees")

    act(() => result.current.markFailed())
    act(() => result.current.markQuoted())

    expect(result.current.hasQuote).toBe(true)
    expect(result.current.hasFailed).toBe(false)
  })

  it("retires a quote when a later attempt fails for the same inputs", () => {
    const { result } = renderWithKey("recommended-fees")

    act(() => result.current.markQuoted())
    act(() => result.current.markFailed())

    expect(result.current.hasFailed).toBe(true)
    expect(result.current.hasQuote).toBe(false)
  })

  it("does not resurrect a quote when the inputs return to an earlier value", () => {
    const { result, rerender } = renderWithKey("wallet|address|1000")

    act(() => result.current.markQuoted())

    // The amount is cleared, and the caller's gate discards on the way through.
    rerender({ inputsKey: null })
    act(() => result.current.discardQuote())

    // The same amount is typed again, producing the very key the old quote answered to.
    rerender({ inputsKey: "wallet|address|1000" })

    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })

  it("keeps an outcome marked while the inputs are absent out of the way", () => {
    const { result, rerender } = renderWithKey(null)

    act(() => result.current.markQuoted())
    rerender({ inputsKey: "wallet|address|1000" })

    // Marking against a null key must not pass for a quote once real inputs arrive.
    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(true)
  })
})
