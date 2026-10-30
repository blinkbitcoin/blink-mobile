import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { WindDownReceiveGate } from "@app/screens/account-migration/wind-down-receive-gate"

let mockReceiveBlocked = false

jest.mock("@app/screens/account-migration/hooks/use-wind-down-receive-blocked", () => ({
  useWindDownReceiveBlocked: () => mockReceiveBlocked,
}))

const mockRefresh = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => ({ windDown: null, isPending: false, refresh: mockRefresh }),
}))

const mockGoBack = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    goBack: mockGoBack,
    replace: mockReplace,
  }),
}))

const Child: React.FC = () => <Text testID="child">child</Text>

describe("WindDownReceiveGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReceiveBlocked = false
    mockCanGoBack = true
  })

  it("renders children while receiving stays open, without navigating", () => {
    const { getByTestId } = render(
      <WindDownReceiveGate>
        <Child />
      </WindDownReceiveGate>,
    )

    expect(getByTestId("child")).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  /** The cutoff can fall within a session: the gate decides from the status as it is
   *  now, asked for once on every visit. */
  it("asks for the status as it is now when it mounts, once", () => {
    const { rerender } = render(
      <WindDownReceiveGate>
        <Child />
      </WindDownReceiveGate>,
    )
    rerender(
      <WindDownReceiveGate>
        <Child />
      </WindDownReceiveGate>,
    )

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it("never mounts the screen and bounces back once receiving is blocked", () => {
    mockReceiveBlocked = true

    const { queryByTestId } = render(
      <WindDownReceiveGate>
        <Child />
      </WindDownReceiveGate>,
    )

    expect(queryByTestId("child")).toBeNull()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("falls back to the primary stack when there is no screen to go back to", () => {
    mockReceiveBlocked = true
    mockCanGoBack = false

    const { queryByTestId } = render(
      <WindDownReceiveGate>
        <Child />
      </WindDownReceiveGate>,
    )

    expect(queryByTestId("child")).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
