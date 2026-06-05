import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import RedeemBitcoinDetailScreen from "@app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen"
import { WalletCurrency } from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../../helpers/flush-effects"

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockUsePayments = jest.fn()
const mockUsePaymentRequestQuery = jest.fn()
const mockUsePriceConversion = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    setOptions: jest.fn(),
  }),
}))

jest.mock("@react-navigation/stack", () => ({
  StackNavigationProp: jest.fn(),
}))

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
}))

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    usePaymentRequestQuery: (options: unknown) => mockUsePaymentRequestQuery(options),
  }
})

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => mockUsePriceConversion(),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} sats`,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  let cached: { LL: Record<string, Record<string, (args?: unknown) => string>> }
  return {
    useI18nContext: () => {
      if (!cached) {
        cached = {
          LL: {
            RedeemBitcoinScreen: {
              title: () => "Redeem Bitcoin",
              usdTitle: () => "Redeem to Dollar account",
              redeemBitcoin: () => "Redeem Bitcoin",
              amountToRedeemFrom: () => "Amount to redeem",
              minMaxRange: () => "min-max",
            },
          },
        }
      }
      return cached
    },
  }
})

jest.mock("@app/components/amount-input", () => ({
  AmountInput: () => null,
}))

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    Screen: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  }
})

jest.mock("@app/components/atomic/galoy-primary-button", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")
  return {
    GaloyPrimaryButton: ({
      title,
      onPress,
      disabled,
    }: {
      title: string
      onPress: () => void
      disabled?: boolean
    }) =>
      ReactActual.createElement(
        TouchableOpacity,
        {
          onPress,
          disabled,
          testID: "redeem-button",
          accessibilityState: { disabled },
        },
        ReactActual.createElement(Text, null, title),
      ),
  }
})

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({ colors: { error: "#f00", grey2: "#777", grey5: "#eee" } }),
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement("Text", null, children),
    useTheme: () => ({ theme: { mode: "dark" } }),
  }
})

const buildRoute = () =>
  ({
    params: {
      receiveDestination: {
        validDestination: {
          callback: "https://example.com/cb",
          domain: "example.com",
          k1: "k1-value",
          defaultDescription: "voucher description",
          minWithdrawable: 1000,
          maxWithdrawable: 100_000_000,
        },
      },
    },
  }) as unknown as Parameters<typeof RedeemBitcoinDetailScreen>[0]["route"]

const baseBtcAmount = {
  amount: 50_000,
  currency: WalletCurrency.Btc,
  currencyCode: "BTC",
}

describe("RedeemBitcoinDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePriceConversion.mockReturnValue({
      convertMoneyAmount: jest.fn().mockReturnValue(baseBtcAmount),
    })
  })

  it("navigates with receivingWalletDescriptor when account is custodial and a btcWallet is resolved", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.Custodial })
    mockUsePaymentRequestQuery.mockReturnValue({
      data: {
        me: {
          defaultAccount: {
            wallets: [
              { id: "btc-wallet-id", walletCurrency: WalletCurrency.Btc, balance: 1 },
            ],
          },
        },
      },
    })

    const route = buildRoute()
    const { getByTestId } = render(<RedeemBitcoinDetailScreen route={route} />)

    await flushEffects()

    fireEvent.press(getByTestId("redeem-button"))

    expect(mockReplace).toHaveBeenCalledTimes(1)
    const [name, params] = mockReplace.mock.calls[0]
    expect(name).toBe("redeemBitcoinResult")
    expect(params.receivingWalletDescriptor).toEqual({
      id: "btc-wallet-id",
      currency: WalletCurrency.Btc,
    })
  })

  it("navigates without receivingWalletDescriptor when account is self-custodial (regression #3808)", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.SelfCustodial })
    mockUsePaymentRequestQuery.mockReturnValue({ data: undefined })

    const route = buildRoute()
    const { getByTestId } = render(<RedeemBitcoinDetailScreen route={route} />)

    await flushEffects()

    fireEvent.press(getByTestId("redeem-button"))

    expect(mockReplace).toHaveBeenCalledTimes(1)
    const [name, params] = mockReplace.mock.calls[0]
    expect(name).toBe("redeemBitcoinResult")
    expect(params.receivingWalletDescriptor).toBeUndefined()
    expect(params.callback).toBe("https://example.com/cb")
    expect(params.k1).toBe("k1-value")
  })

  it("does not navigate when account is custodial and the wallet query has no btcWallet (guard preserved)", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.Custodial })
    mockUsePaymentRequestQuery.mockReturnValue({ data: undefined })

    const route = buildRoute()
    const { getByTestId } = render(<RedeemBitcoinDetailScreen route={route} />)

    await flushEffects()

    fireEvent.press(getByTestId("redeem-button"))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("forwards minWithdrawableSatoshis and maxWithdrawableSatoshis converted from msats (root-cause guard for #3808)", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.SelfCustodial })
    mockUsePaymentRequestQuery.mockReturnValue({ data: undefined })

    const route = buildRoute()
    const { getByTestId } = render(<RedeemBitcoinDetailScreen route={route} />)

    await flushEffects()

    fireEvent.press(getByTestId("redeem-button"))

    expect(mockReplace).toHaveBeenCalledTimes(1)
    const [, params] = mockReplace.mock.calls[0]
    expect(params.minWithdrawableSatoshis).toEqual({
      amount: 1,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    })
    expect(params.maxWithdrawableSatoshis).toEqual({
      amount: 100_000,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    })
  })

  it("rounds non-divisible msats limits to the nearest sat through to navigation (rounding wire-through)", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.SelfCustodial })
    mockUsePaymentRequestQuery.mockReturnValue({ data: undefined })

    const route = {
      params: {
        receiveDestination: {
          validDestination: {
            callback: "https://example.com/cb",
            domain: "example.com",
            k1: "k1-value",
            defaultDescription: "voucher description",
            minWithdrawable: 1500,
            maxWithdrawable: 100_000_000,
          },
        },
      },
    } as unknown as Parameters<typeof RedeemBitcoinDetailScreen>[0]["route"]

    const { getByTestId } = render(<RedeemBitcoinDetailScreen route={route} />)

    await flushEffects()

    fireEvent.press(getByTestId("redeem-button"))

    const [, params] = mockReplace.mock.calls[0]
    expect(params.minWithdrawableSatoshis.amount).toBe(2)
    expect(params.maxWithdrawableSatoshis.amount).toBe(100_000)
  })

  it("skips the custodial wallet query when account is self-custodial", async () => {
    mockUsePayments.mockReturnValue({ accountType: AccountType.SelfCustodial })
    mockUsePaymentRequestQuery.mockReturnValue({ data: undefined })

    render(<RedeemBitcoinDetailScreen route={buildRoute()} />)

    await flushEffects()

    expect(mockUsePaymentRequestQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })
})
