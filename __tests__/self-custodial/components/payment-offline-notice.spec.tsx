import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

import { PaymentOfflineNotice } from "@app/self-custodial/components/payment-offline-notice"

const mockRefreshWallets = jest.fn()

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    refreshWallets: mockRefreshWallets,
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

  it("calls refreshWallets when the retry button is pressed", () => {
    const { getByTestId } = renderNotice()

    fireEvent.press(getByTestId("payment-offline-retry"))

    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
  })

  it("is idempotent: pressing retry multiple times fires a call each time", () => {
    const { getByTestId } = renderNotice()

    const retryButton = getByTestId("payment-offline-retry")
    fireEvent.press(retryButton)
    fireEvent.press(retryButton)
    fireEvent.press(retryButton)

    expect(mockRefreshWallets).toHaveBeenCalledTimes(3)
  })
})
