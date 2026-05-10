import React from "react"
import { render } from "@testing-library/react-native"

import { AutoConvertListenerMount } from "@app/self-custodial/components/auto-convert-listener-mount"

const mockListener = jest.fn()

jest.mock("@app/self-custodial/hooks/use-auto-convert-listener", () => ({
  useAutoConvertListener: () => mockListener(),
}))

describe("AutoConvertListenerMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("mounts the listener hook exactly once per render", () => {
    render(<AutoConvertListenerMount />)
    expect(mockListener).toHaveBeenCalledTimes(1)
  })

  it("renders null so it contributes no UI to the tree", () => {
    const { toJSON } = render(<AutoConvertListenerMount />)
    expect(toJSON()).toBeNull()
  })

  it("does not swallow errors thrown by the listener hook (Important #10)", () => {
    // The wrapper has no try/catch around the hook; a crash must propagate
    // to React rather than be silently absorbed by the wrapper.
    mockListener.mockImplementationOnce(() => {
      throw new Error("listener crashed")
    })

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<AutoConvertListenerMount />)).toThrow("listener crashed")
    consoleErrorSpy.mockRestore()
  })
})
