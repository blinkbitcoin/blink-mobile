import React from "react"
import { BackHandler } from "react-native"
import { render } from "@testing-library/react-native"

import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

const GuardedComponent: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  useHardwareBackGuard(onBack)
  return null
}

describe("useHardwareBackGuard", () => {
  const mockRemove = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove: mockRemove } as never)
  })

  const registeredHandler = (): (() => boolean) =>
    (BackHandler.addEventListener as jest.Mock).mock.calls[0][1]

  it("swallows the hardware back while focused", () => {
    render(<GuardedComponent />)

    expect(registeredHandler()()).toBe(true)
  })

  it("redirects the hardware back when a handler is provided", () => {
    const onBack = jest.fn()
    render(<GuardedComponent onBack={onBack} />)

    expect(registeredHandler()()).toBe(true)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("releases the interception on unmount", () => {
    const { unmount } = render(<GuardedComponent />)

    unmount()

    expect(mockRemove).toHaveBeenCalledTimes(1)
  })
})
