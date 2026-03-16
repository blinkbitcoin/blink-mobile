import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { MemoizedTransactionItem } from "@app/components/transaction-item/transaction-item"

// --- react-native-reanimated ---
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: (_fn: () => object) => ({}),
}))

// --- @apollo/client ---
jest.mock("@apollo/client", () => ({
  useFragment: jest.fn(),
}))

// --- @app/graphql/generated ---
jest.mock("@app/graphql/generated", () => ({
  TransactionFragmentDoc: {},
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
}))

// --- @app/graphql/hide-amount-context ---
jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: jest.fn(),
}))

// --- @app/hooks ---
jest.mock("@app/hooks", () => ({
  useAppConfig: jest.fn(),
}))

// --- @app/hooks/use-display-currency ---
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: jest.fn(),
}))

// --- @app/i18n/i18n-react ---
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        from: () => "from",
        to: () => "to",
      },
    },
  }),
}))

// --- @react-navigation/native ---
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}))

// --- @app/components/animations ---
jest.mock("@app/components/animations", () => ({
  useBounceInAnimation: jest.fn(),
}))

// --- @app/utils/testProps ---
jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

// --- HiddenBalanceIndicator ---
jest.mock("@app/components/hidden-balance-indicator/hidden-balance-indicator", () => ({
  HiddenBalanceIndicator: () => <View testID="hidden-balance-indicator" />,
}))

// --- child components that would otherwise require native modules ---
jest.mock("@app/components/icon-transactions", () => ({
  IconTransaction: () => null,
}))

jest.mock("@app/components/transaction-date", () => ({
  TransactionDate: () => null,
}))

// --- @rn-vui/themed ---
jest.mock("@rn-vui/themed", () => {
  const ListItemContent = ({ children }: React.PropsWithChildren) => (
    <View>{children}</View>
  )
  const ListItemTitle = ({
    children,
    ...rest
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <RNText {...rest}>{children}</RNText>
  )
  const ListItemSubtitle = ({ children }: React.PropsWithChildren) => (
    <View>{children}</View>
  )

  const ListItem = ({
    children,
    ...rest
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <View {...rest}>{children}</View>
  )
  ListItem.Content = ListItemContent
  ListItem.Title = ListItemTitle
  ListItem.Subtitle = ListItemSubtitle

  return {
    Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
    ListItem,
    useTheme: () => ({
      theme: {
        colors: {
          grey0: "#333333",
          grey1: "#555555",
          grey4: "#CCCCCC",
          grey5: "#F5F5F5",
          _green: "#00AA00",
          primary: "#F7931A",
        },
      },
    }),
    makeStyles: () => () => ({
      container: {},
      hiddenBalanceContainer: {},
      pending: {},
      receive: {},
      send: {},
      title: {},
      subtitle: {},
      amountWrapper: {},
    }),
  }
})

// --- @app/types/amounts ---
jest.mock("@app/types/amounts", () => ({
  toWalletAmount: ({ amount, currency }: { amount: number; currency: string }) => ({
    amount,
    currency,
  }),
}))

// ─── imports needed for mocking ───────────────────────────────────────────────
import { useFragment } from "@apollo/client"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"

const mockUseFragment = useFragment as jest.Mock
const mockUseHideAmount = useHideAmount as jest.Mock
const mockUseAppConfig = useAppConfig as jest.Mock
const mockUseDisplayCurrency = useDisplayCurrency as jest.Mock

// ─── minimal transaction fragment ────────────────────────────────────────────
const makeTx = (overrides = {}) => ({
  id: "tx-1",
  status: "SUCCESS",
  direction: "SEND",
  memo: null,
  createdAt: 1700000000,
  settlementAmount: 1000,
  settlementFee: 1,
  settlementDisplayFee: "0.01",
  settlementCurrency: "BTC",
  settlementDisplayAmount: "10.00",
  settlementDisplayCurrency: "USD",
  settlementPrice: { base: 1, offset: 0, currencyUnit: "USDCENT", formattedAmount: "1" },
  initiationVia: { __typename: "InitiationViaLn" },
  settlementVia: { __typename: "SettlementViaLn" },
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()

  mockUseFragment.mockReturnValue({ data: makeTx() })

  mockUseHideAmount.mockReturnValue({
    hideAmount: false,
    switchMemoryHideAmount: jest.fn(),
  })

  mockUseAppConfig.mockReturnValue({
    appConfig: { galoyInstance: { name: "Blink" } },
  })

  mockUseDisplayCurrency.mockReturnValue({
    formatMoneyAmount: () => "1,000 sats",
    formatCurrency: () => "$10.00",
  })
})

describe("MemoizedTransactionItem", () => {
  describe("when hideAmount is false", () => {
    it("shows the formatted display amount text", () => {
      const { getByText } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(getByText("$10.00")).toBeTruthy()
    })

    it("does not render the HiddenBalanceIndicator", () => {
      const { queryByTestId } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(queryByTestId("hidden-balance-indicator")).toBeNull()
    })
  })

  describe("when hideAmount is true", () => {
    beforeEach(() => {
      mockUseHideAmount.mockReturnValue({
        hideAmount: true,
        switchMemoryHideAmount: jest.fn(),
      })
    })

    it("does not show amount text", () => {
      const { queryByText } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(queryByText("$10.00")).toBeNull()
    })

    it("renders the HiddenBalanceIndicator", () => {
      const { getByTestId } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(getByTestId("hidden-balance-indicator")).toBeTruthy()
    })
  })

  describe("pressing the amount area", () => {
    it("calls switchMemoryHideAmount", () => {
      const mockSwitch = jest.fn()
      mockUseHideAmount.mockReturnValue({
        hideAmount: false,
        switchMemoryHideAmount: mockSwitch,
      })

      const { getByText } = render(<MemoizedTransactionItem txid="tx-1" />)
      fireEvent.press(getByText("$10.00"))

      expect(mockSwitch).toHaveBeenCalledTimes(1)
    })
  })

  describe("returns null for incomplete transaction data", () => {
    it("renders nothing when fragment data is empty", () => {
      mockUseFragment.mockReturnValue({ data: {} })
      const { toJSON } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(toJSON()).toBeNull()
    })

    it("renders nothing when required fields are missing", () => {
      mockUseFragment.mockReturnValue({
        data: { id: "tx-1", status: null, direction: "SEND" },
      })
      const { toJSON } = render(<MemoizedTransactionItem txid="tx-1" />)
      expect(toJSON()).toBeNull()
    })
  })
})
