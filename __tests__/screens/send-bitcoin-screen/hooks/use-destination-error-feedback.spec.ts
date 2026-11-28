import { it } from "@jest/globals"
import { renderHook } from "@testing-library/react-native"

import { useDestinationErrorFeedback } from "@app/screens/send-bitcoin-screen/hooks/use-destination-error-feedback"
import { DestinationState } from "@app/screens/send-bitcoin-screen/send-bitcoin-reducer"
import { haptics } from "@app/utils/haptics"

jest.mock("@app/utils/haptics", () => ({
  haptics: { error: jest.fn(), reject: jest.fn() },
}))

type Props = { state: string }

const renderFeedback = (state: string) =>
  renderHook(({ state }: Props) => useDestinationErrorFeedback(state), {
    initialProps: { state },
  })

describe("useDestinationErrorFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    DestinationState.Invalid,
    DestinationState.PhoneInvalid,
    DestinationState.PhoneNotAllowed,
  ])("flags %s and buzzes the light refusal", (state) => {
    const { result } = renderFeedback(state)

    expect(result.current).toBe(true)
    expect(haptics.reject).toHaveBeenCalledTimes(1)
    expect(haptics.error).not.toHaveBeenCalled()
  })

  it.each([
    DestinationState.Entering,
    DestinationState.Pasting,
    DestinationState.Validating,
    DestinationState.Valid,
    DestinationState.RequiresUsernameConfirmation,
  ])("leaves %s alone", (state) => {
    const { result } = renderFeedback(state)

    expect(result.current).toBe(false)
    expect(haptics.reject).not.toHaveBeenCalled()
  })

  it("buzzes once for a failed check that holds across re-renders", () => {
    const { rerender } = renderFeedback(DestinationState.Invalid)

    rerender({ state: DestinationState.Invalid })

    expect(haptics.reject).toHaveBeenCalledTimes(1)
  })

  it("buzzes again when an edit leads to the next failed check", () => {
    const { rerender } = renderFeedback(DestinationState.Invalid)

    rerender({ state: DestinationState.Entering })
    rerender({ state: DestinationState.Validating })
    rerender({ state: DestinationState.Invalid })

    expect(haptics.reject).toHaveBeenCalledTimes(2)
  })

  it("buzzes again when one failure turns into another", () => {
    const { rerender } = renderFeedback(DestinationState.PhoneInvalid)

    rerender({ state: DestinationState.PhoneNotAllowed })

    expect(haptics.reject).toHaveBeenCalledTimes(2)
  })
})
