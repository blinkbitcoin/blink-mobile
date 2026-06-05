import React from "react"
import { ActivityIndicator } from "react-native"
import { render } from "@testing-library/react-native"

import RedeemBitcoinResultScreen from "@app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen"
import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"

import { flushEffects } from "../../helpers/flush-effects"

const mockUseLnurlWithdrawRedemption = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  }),
}))

jest.mock("@react-navigation/stack", () => ({
  StackNavigationProp: jest.fn(),
}))

jest.mock(
  "@app/screens/redeem-lnurl-withdrawal-screen/hooks/use-lnurl-withdraw-redemption",
  () => ({
    useLnurlWithdrawRedemption: (params: unknown) =>
      mockUseLnurlWithdrawRedemption(params),
  }),
)

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatDisplayAndWalletAmount: () => "10 sats / $0.01",
  }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  let cached: {
    LL: {
      RedeemBitcoinScreen: {
        title: () => string
        redeemAmountFrom: () => string
        paymentPending: () => string
      }
    }
  }
  return {
    useI18nContext: () => {
      if (!cached) {
        cached = {
          LL: {
            RedeemBitcoinScreen: {
              title: () => "Redeem Bitcoin",
              redeemAmountFrom: () => "Redeem 10 sats from example.com",
              paymentPending: () => "Your payment may still be completing.",
            },
          },
        }
      }
      return cached
    },
  }
})

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    Screen: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    GaloyIcon: ({ name }: { name: string }) =>
      ReactActual.createElement(View, { testID: `icon-${name}` }),
  }
})

jest.mock("@app/screens/receive-bitcoin-screen/my-ln-updates-sub", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    withMyLnUpdateSub:
      <P extends object>(Component: React.ComponentType<P>) =>
      (props: P) =>
        ReactActual.createElement(
          View,
          { testID: "my-ln-update-sub-wrapper" },
          ReactActual.createElement(Component, props),
        ),
  }
})

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({
          colors: {
            primary: "#fc5805",
            error: "#f00",
            grey5: "#eee",
            warning: "#f59e0b",
          },
        }),
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement("Text", null, children),
    useTheme: () => ({ theme: { mode: "dark", colors: { primary: "#fc5805" } } }),
  }
})

const buildRoute = () => {
  const btcAmount = {
    amount: 10,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC",
  } as const
  const displayMoney = {
    amount: 1,
    currency: DisplayCurrency,
    currencyCode: "USD",
  } as const
  return {
    params: {
      callback: "https://example.com/cb",
      domain: "example.com",
      k1: "k1-value",
      defaultDescription: "voucher description",
      minWithdrawableSatoshis: btcAmount,
      maxWithdrawableSatoshis: btcAmount,
      receivingWalletDescriptor: { id: "btc-wallet-id", currency: WalletCurrency.Btc },
      unitOfAccountAmount: btcAmount,
      settlementAmount: btcAmount,
      displayAmount: displayMoney,
    },
  } as unknown as Parameters<typeof RedeemBitcoinResultScreen>[0]["route"]
}

describe("RedeemBitcoinResultScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLnurlWithdrawRedemption.mockReturnValue({
      paid: false,
      errorMessage: "",
      lnServiceErrorReason: "",
    })
  })

  it("forwards every route-derived field to useLnurlWithdrawRedemption (including walletId from receivingWalletDescriptor)", async () => {
    render(<RedeemBitcoinResultScreen route={buildRoute()} />)

    await flushEffects()

    expect(mockUseLnurlWithdrawRedemption).toHaveBeenCalled()
    const lastCallArg =
      mockUseLnurlWithdrawRedemption.mock.calls[
        mockUseLnurlWithdrawRedemption.mock.calls.length - 1
      ][0]
    expect(lastCallArg).toEqual({
      walletId: "btc-wallet-id",
      amountSats: 10,
      callback: "https://example.com/cb",
      k1: "k1-value",
      defaultDescription: "voucher description",
      minWithdrawableSatoshis: 10,
      maxWithdrawableSatoshis: 10,
    })
  })

  it("passes walletId=undefined to the hook when the route has no receivingWalletDescriptor (self-custodial nav path)", async () => {
    const route = buildRoute()
    ;(route.params as { receivingWalletDescriptor?: unknown }).receivingWalletDescriptor =
      undefined

    render(<RedeemBitcoinResultScreen route={route} />)

    await flushEffects()

    const lastCallArg =
      mockUseLnurlWithdrawRedemption.mock.calls[
        mockUseLnurlWithdrawRedemption.mock.calls.length - 1
      ][0]
    expect(lastCallArg.walletId).toBeUndefined()
  })

  it("renders the success icon when the hook reports paid=true", async () => {
    mockUseLnurlWithdrawRedemption.mockReturnValue({
      paid: true,
      errorMessage: "",
      lnServiceErrorReason: "",
    })

    const { queryByTestId } = render(<RedeemBitcoinResultScreen route={buildRoute()} />)

    await flushEffects()

    expect(queryByTestId("icon-payment-success")).toBeTruthy()
  })

  it("renders the error message when the hook reports an errorMessage", async () => {
    mockUseLnurlWithdrawRedemption.mockReturnValue({
      paid: false,
      errorMessage: "Insufficient funds",
      lnServiceErrorReason: "",
    })

    const { queryByText, queryByTestId } = render(
      <RedeemBitcoinResultScreen route={buildRoute()} />,
    )

    await flushEffects()

    expect(queryByText("Insufficient funds")).toBeTruthy()
    expect(queryByTestId("icon-payment-success")).toBeNull()
  })

  it("renders the ActivityIndicator while paid=false and errorMessage is empty (loading state parity with custodial)", async () => {
    // eslint-disable-next-line camelcase
    const { UNSAFE_queryByType, queryByTestId } = render(
      <RedeemBitcoinResultScreen route={buildRoute()} />,
    )

    await flushEffects()

    // eslint-disable-next-line camelcase
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
    expect(queryByTestId("icon-payment-success")).toBeNull()
  })

  it("renders the lnServiceErrorReason alongside the errorMessage when both are present", async () => {
    mockUseLnurlWithdrawRedemption.mockReturnValue({
      paid: false,
      errorMessage: "Redeeming error",
      lnServiceErrorReason: "voucher already used",
    })

    const { queryByText } = render(<RedeemBitcoinResultScreen route={buildRoute()} />)

    await flushEffects()

    expect(queryByText("voucher already used")).toBeTruthy()
    expect(queryByText("Redeeming error")).toBeTruthy()
  })

  it("renders the pending message and hides the spinner when the hook reports pending=true (C2)", async () => {
    mockUseLnurlWithdrawRedemption.mockReturnValue({
      paid: false,
      pending: true,
      errorMessage: "",
      lnServiceErrorReason: "",
    })

    // eslint-disable-next-line camelcase
    const { queryByText, UNSAFE_queryByType } = render(
      <RedeemBitcoinResultScreen route={buildRoute()} />,
    )

    await flushEffects()

    expect(queryByText("Your payment may still be completing.")).toBeTruthy()
    // eslint-disable-next-line camelcase
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull()
  })

  it("wraps the screen in withMyLnUpdateSub so the custodial paid signal stays subscribed (HOC contract)", async () => {
    const { queryByTestId } = render(<RedeemBitcoinResultScreen route={buildRoute()} />)

    await flushEffects()

    expect(queryByTestId("my-ln-update-sub-wrapper")).toBeTruthy()
  })
})
