import React from "react"
import { render, renderHook } from "@testing-library/react-native"

import { ErrorHaptic, useErrorHaptic } from "@app/hooks/use-error-haptic"
import { haptics } from "@app/utils/haptics"

jest.mock("@app/utils/haptics", () => ({
  haptics: { error: jest.fn(), reject: jest.fn() },
}))

type Props = { error: unknown; kind?: "error" | "reject" }

const renderErrorHaptic = (error: unknown, kind?: Props["kind"]) =>
  renderHook(({ error, kind }: Props) => useErrorHaptic(error, kind), {
    initialProps: { error, kind },
  })

describe("useErrorHaptic", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays still while there is no error", () => {
    renderErrorHaptic(undefined)

    expect(haptics.error).not.toHaveBeenCalled()
  })

  it("buzzes the error haptic as an error appears", () => {
    renderErrorHaptic(new Error("Low funds"))

    expect(haptics.error).toHaveBeenCalledTimes(1)
    expect(haptics.reject).not.toHaveBeenCalled()
  })

  it("buzzes the light refusal for an error fixed in place", () => {
    renderErrorHaptic("over balance", "reject")

    expect(haptics.reject).toHaveBeenCalledTimes(1)
    expect(haptics.error).not.toHaveBeenCalled()
  })

  it("stays quiet on a re-render holding the same error", () => {
    const error = { message: "Low funds" }
    const { rerender } = renderErrorHaptic(error)

    rerender({ error })
    rerender({ error })

    expect(haptics.error).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when only the kind changes while the error holds", () => {
    const error = { message: "Low funds" }
    const { rerender } = renderErrorHaptic(error, "reject")

    rerender({ error, kind: "error" })

    expect(haptics.reject).toHaveBeenCalledTimes(1)
    expect(haptics.error).not.toHaveBeenCalled()
  })

  it("buzzes again for another error, even one with the same text", () => {
    const { rerender } = renderErrorHaptic({ message: "Low funds" })

    rerender({ error: { message: "Low funds" } })

    expect(haptics.error).toHaveBeenCalledTimes(2)
  })

  it("buzzes again when the error clears and comes back", () => {
    const error = { message: "Low funds" }
    const { rerender } = renderErrorHaptic(error)

    rerender({ error: undefined })
    rerender({ error })

    expect(haptics.error).toHaveBeenCalledTimes(2)
  })
})

describe("ErrorHaptic", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("buzzes like the hook and renders nothing", () => {
    const { toJSON } = render(<ErrorHaptic error="invalid" kind="reject" />)

    expect(toJSON()).toBeNull()
    expect(haptics.reject).toHaveBeenCalledTimes(1)
  })
})
