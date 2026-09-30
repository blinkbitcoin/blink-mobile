import React, { PropsWithChildren } from "react"
import { renderHook } from "@testing-library/react-native"

import { useSessionGuard } from "@app/hooks/use-session-guard"
import { PersistentStateContext } from "@app/store/persistent-state"

type Session = { galoyAuthToken: string; activeAccountId?: string }

let mockSession: Session = { galoyAuthToken: "token-a" }

const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
  <PersistentStateContext.Provider
    value={{
      persistentState: {
        schemaVersion: 23,
        galoyInstance: { id: "Main" },
        ...mockSession,
      },
      updateState: () => {},
      resetState: () => {},
      clearToken: async () => true,
    }}
  >
    {children}
  </PersistentStateContext.Provider>
)

const renderGuard = () => renderHook(() => useSessionGuard(), { wrapper: Wrapper })

describe("useSessionGuard", () => {
  beforeEach(() => {
    mockSession = { galoyAuthToken: "token-a" }
  })

  it("lets the work go on under the session it began under", () => {
    const { result, rerender } = renderGuard()
    const isOwnSession = result.current.captureSession()

    rerender({})

    expect(isOwnSession()).toBe(true)
  })

  it("stops it once another token is in use", () => {
    const { result, rerender } = renderGuard()
    const isOwnSession = result.current.captureSession()

    mockSession = { galoyAuthToken: "token-b" }
    rerender({})

    expect(isOwnSession()).toBe(false)
  })

  it("stops it once another profile is active on the same token", () => {
    const { result, rerender } = renderGuard()
    const isOwnSession = result.current.captureSession()

    mockSession = { galoyAuthToken: "token-a", activeAccountId: "self-custodial" }
    rerender({})

    expect(isOwnSession()).toBe(false)
  })

  it("stops it once the screen is gone, whose session can no longer be told", () => {
    const { result, unmount } = renderGuard()
    const isOwnSession = result.current.captureSession()

    unmount()

    expect(isOwnSession()).toBe(false)
  })

  it("takes the session anew on each capture", () => {
    const { result, rerender } = renderGuard()

    mockSession = { galoyAuthToken: "token-b" }
    rerender({})
    const isOwnSession = result.current.captureSession()

    expect(isOwnSession()).toBe(true)
  })
})
