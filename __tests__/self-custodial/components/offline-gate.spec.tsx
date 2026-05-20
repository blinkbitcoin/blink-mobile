import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { ActiveWalletStatus } from "@app/types/wallet.types"

import { OfflineGate } from "@app/self-custodial/components/offline-gate"

const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/components/self-custodial-payment-offline-notice", () => ({
  SelfCustodialPaymentOfflineNotice: () => {
    const { Text: RnText } = jest.requireActual("react-native")
    return <RnText testID="offline-notice">offline</RnText>
  },
}))

const Child: React.FC = () => <Text testID="child">child</Text>

describe("OfflineGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders children when the active wallet is custodial (regardless of status)", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      status: ActiveWalletStatus.Offline,
    })

    const { getByTestId, queryByTestId } = render(
      <OfflineGate>
        <Child />
      </OfflineGate>,
    )

    expect(getByTestId("child")).toBeTruthy()
    expect(queryByTestId("offline-notice")).toBeNull()
  })

  it("renders the offline notice when self-custodial + status is Offline", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Offline,
    })

    const { getByTestId, queryByTestId } = render(
      <OfflineGate>
        <Child />
      </OfflineGate>,
    )

    expect(getByTestId("offline-notice")).toBeTruthy()
    expect(queryByTestId("child")).toBeNull()
  })

  it("renders children when self-custodial + status is Ready", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Ready,
    })

    const { getByTestId, queryByTestId } = render(
      <OfflineGate>
        <Child />
      </OfflineGate>,
    )

    expect(getByTestId("child")).toBeTruthy()
    expect(queryByTestId("offline-notice")).toBeNull()
  })

  it("renders children when self-custodial + status is Loading", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      status: ActiveWalletStatus.Loading,
    })

    const { getByTestId, queryByTestId } = render(
      <OfflineGate>
        <Child />
      </OfflineGate>,
    )

    expect(getByTestId("child")).toBeTruthy()
    expect(queryByTestId("offline-notice")).toBeNull()
  })
})
