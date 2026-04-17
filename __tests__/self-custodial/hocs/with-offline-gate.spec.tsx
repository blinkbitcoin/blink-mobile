import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { ActiveWalletStatus } from "@app/types/wallet.types"

import { withOfflineGate } from "@app/self-custodial/hocs/with-offline-gate"

const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/components/sc-payment-offline-notice", () => ({
  ScPaymentOfflineNotice: () => {
    const { Text: RnText } = jest.requireActual("react-native")
    return <RnText testID="offline-notice">offline</RnText>
  },
}))

const makeChild = () => {
  const Child: React.FC<{ label: string }> = ({ label }) => (
    <Text testID="child">{label}</Text>
  )
  return Child
}

describe("withOfflineGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the wrapped component when active wallet is custodial (regardless of status)", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Offline,
    })

    const Gated = withOfflineGate(makeChild())
    const { queryByTestId, getByTestId } = render(<Gated label="payment-ui" />)

    expect(getByTestId("child")).toBeTruthy()
    expect(queryByTestId("offline-notice")).toBeNull()
  })

  it("renders the offline notice when self-custodial + status is Offline", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Offline,
    })

    const Gated = withOfflineGate(makeChild())
    const { queryByTestId, getByTestId } = render(<Gated label="payment-ui" />)

    expect(getByTestId("offline-notice")).toBeTruthy()
    expect(queryByTestId("child")).toBeNull()
  })

  it("renders the wrapped component when self-custodial and status is Ready", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })

    const Gated = withOfflineGate(makeChild())
    const { getByTestId, queryByTestId } = render(<Gated label="payment-ui" />)

    expect(getByTestId("child")).toBeTruthy()
    expect(queryByTestId("offline-notice")).toBeNull()
  })

  it("forwards props to the wrapped component", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })

    const Gated = withOfflineGate(makeChild())
    const { getByText } = render(<Gated label="hello-props" />)

    expect(getByText("hello-props")).toBeTruthy()
  })

  it("sets a displayName that references the wrapped component", () => {
    const Named: React.FC = () => null
    Named.displayName = "CustomPaymentScreen"

    const Gated = withOfflineGate(Named)

    expect(Gated.displayName).toBe("WithOfflineGate(CustomPaymentScreen)")
  })

  it("returns the same wrapped component for the same input (stable reference)", () => {
    const Child = makeChild()

    expect(withOfflineGate(Child)).toBe(withOfflineGate(Child))
  })

  it("returns different wrappers for different input components", () => {
    const ChildA = makeChild()
    const ChildB = makeChild()

    expect(withOfflineGate(ChildA)).not.toBe(withOfflineGate(ChildB))
  })
})
