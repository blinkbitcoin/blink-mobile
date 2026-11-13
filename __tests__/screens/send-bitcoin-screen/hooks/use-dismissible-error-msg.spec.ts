import { act, renderHook } from "@testing-library/react-native"

import { useDismissibleErrorMsg } from "@app/screens/send-bitcoin-screen/hooks/use-dismissible-error-msg"

type ErrorMsg = { message: string }
type Props = { error: ErrorMsg | undefined }

const renderSheetState = (error: ErrorMsg | undefined) =>
  renderHook(({ error }: Props) => useDismissibleErrorMsg(error), {
    initialProps: { error },
  })

describe("useDismissibleErrorMsg", () => {
  it("is hidden while there is no error", () => {
    const { result } = renderSheetState(undefined)

    expect(result.current.isVisible).toBe(false)
    expect(result.current.shown).toBeUndefined()
  })

  it("shows an error as it appears", () => {
    const error = { message: "Low funds" }
    const { result } = renderSheetState(error)

    expect(result.current.isVisible).toBe(true)
    expect(result.current.shown).toBe(error)
  })

  it("stays closed once dismissed while the same error holds", () => {
    const error = { message: "Low funds" }
    const { result, rerender } = renderSheetState(error)

    act(() => result.current.dismiss())
    rerender({ error })

    expect(result.current.isVisible).toBe(false)
  })

  it("opens again for a new error, even one with the same text", () => {
    const { result, rerender } = renderSheetState({ message: "Low funds" })

    act(() => result.current.dismiss())
    rerender({ error: { message: "Low funds" } })

    expect(result.current.isVisible).toBe(true)
  })

  it("keeps showing the last error while the sheet slides out after it cleared", () => {
    const error = { message: "Low funds" }
    const { result, rerender } = renderSheetState(error)

    rerender({ error: undefined })

    expect(result.current.isVisible).toBe(false)
    expect(result.current.shown).toBe(error)
  })
})
