import React from "react"
import { render } from "@testing-library/react-native"

// React 19 react-test-renderer calls window.dispatchEvent for error
// reporting which doesn't exist in React Native jest environment.
if (typeof window !== "undefined" && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn()
}

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

  it("does not swallow errors thrown by the listener hook", () => {
    // The wrapper has no try/catch around the hook; a crash must surface via
    // an ErrorBoundary instead of being silently absorbed by the wrapper.
    mockListener.mockImplementationOnce(() => {
      throw new Error("listener crashed")
    })

    const captured: { error: Error | null } = { error: null }
    class Boundary extends React.Component<
      { children: React.ReactNode },
      { error: Error | null }
    > {
      state = { error: null as Error | null }
      static getDerivedStateFromError(error: Error) {
        captured.error = error
        return { error }
      }
      render() {
        return this.state.error ? null : this.props.children
      }
    }

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    render(
      <Boundary>
        <AutoConvertListenerMount />
      </Boundary>,
    )
    consoleErrorSpy.mockRestore()
    expect(captured.error?.message).toBe("listener crashed")
  })
})
