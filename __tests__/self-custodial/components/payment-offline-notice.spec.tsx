import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

import { PaymentOfflineNotice } from "@app/self-custodial/components/payment-offline-notice"

const mockRefreshWallets = jest.fn()
const mockRetry = jest.fn()
const mockSdk: { current: object | null } = { current: { id: "sdk" } }

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    refreshWallets: mockRefreshWallets,
    retry: mockRetry,
    sdk: mockSdk.current,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SelfCustodialOffline: {
        title: () => "Wallet is offline",
        description: () =>
          "Your non-custodial wallet can't reach the network right now. Try again when you're back online.",
        retry: () => "Try again",
      },
    },
  }),
}))

const renderNotice = () =>
  render(
    <ThemeProvider theme={theme}>
      <PaymentOfflineNotice />
    </ThemeProvider>,
  )

describe("PaymentOfflineNotice", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSdk.current = { id: "sdk" }
  })

  it("renders the offline title and description", () => {
    const { getByText } = renderNotice()

    expect(getByText("Wallet is offline")).toBeTruthy()
    expect(
      getByText(
        "Your non-custodial wallet can't reach the network right now. Try again when you're back online.",
      ),
    ).toBeTruthy()
  })

  it("renders the retry button", () => {
    const { getByTestId } = renderNotice()

    expect(getByTestId("payment-offline-retry")).toBeTruthy()
  })

  it("refreshes when a wallet is connected, which is what being offline means here", () => {
    const { getByTestId } = renderNotice()

    fireEvent.press(getByTestId("payment-offline-retry"))

    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(mockRetry).not.toHaveBeenCalled()
  })

  /**
   * The screen is also shown for a wallet that never started — a keystore that
   * would not answer, a network marker that could not be verified. There
   * `refreshWallets` returns on its first line for want of an SDK, so the button
   * could not succeed however often it was pressed. Re-running the lifecycle is
   * the only thing that reaches those.
   */
  it("re-runs the lifecycle when nothing ever connected, where refreshing cannot work", () => {
    mockSdk.current = null
    const { getByTestId } = renderNotice()

    fireEvent.press(getByTestId("payment-offline-retry"))

    expect(mockRetry).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })

  it("is idempotent: pressing retry multiple times fires a call each time", () => {
    const { getByTestId } = renderNotice()

    const retryButton = getByTestId("payment-offline-retry")
    fireEvent.press(retryButton)
    fireEvent.press(retryButton)
    fireEvent.press(retryButton)

    expect(mockRefreshWallets).toHaveBeenCalledTimes(3)
  })

  it("stays idempotent on the lifecycle path too", () => {
    mockSdk.current = null
    const { getByTestId } = renderNotice()

    const retryButton = getByTestId("payment-offline-retry")
    fireEvent.press(retryButton)
    fireEvent.press(retryButton)

    expect(mockRetry).toHaveBeenCalledTimes(2)
  })
})
