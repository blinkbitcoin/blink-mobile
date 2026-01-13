import React from "react"
import { Text as ReactNativeText, TextInput } from "react-native"
import { render } from "@testing-library/react-native"

import { WalletAmountRow } from "@app/components/wallet-selector/wallet-amount-row"
import { WalletCurrency } from "@app/graphql/generated"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  // eslint-disable-next-line react/display-name
  Input: React.forwardRef(
    (
      {
        value,
        placeholder,
        testID,
      }: {
        value: string
        onFocus: () => void
        placeholder: string
        testID?: string
      },
      _ref: React.Ref<TextInput>,
    ) => <ReactNativeText testID={testID}>{value || placeholder}</ReactNativeText>,
  ),
  useTheme: () => ({
    theme: {
      colors: {
        grey2: "grey2",
      },
    },
  }),
  makeStyles: () => () => ({
    row: {},
    disabledOpacity: {},
    primaryNumberContainer: {},
    inputWithOverlay: {},
    primaryNumberText: {},
    primaryNumberInputContainer: {},
    inputOverlay: {},
    rightColumn: {},
    currencyBubbleText: {},
    walletSelectorBalanceContainer: {},
    convertText: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        bitcoin: () => "Bitcoin",
        dollar: () => "Dollar",
      },
    },
  }),
}))

jest.mock("@app/components/atomic/currency-pill", () => ({
  CurrencyPill: ({ label }: { label: string }) => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.Text testID="currency-pill">{label}</ReactNative.Text>
  },
}))

describe("WalletAmountRow", () => {
  const mockInputRef = React.createRef<TextInput>()
  const mockOnOverlayPress = jest.fn()
  const mockOnFocus = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders with BTC currency and balances", () => {
    const { getByText } = render(
      <WalletAmountRow
        inputRef={mockInputRef}
        value="1000"
        placeholder="0"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={mockOnOverlayPress}
        onFocus={mockOnFocus}
        currency={WalletCurrency.Btc}
        balancePrimary="1,000 sats"
        balanceSecondary="$10.00"
      />,
    )

    expect(getByText("Bitcoin")).toBeTruthy()
    expect(getByText("1,000 sats")).toBeTruthy()
  })

  it("renders with USD currency and balances", () => {
    const { getByText } = render(
      <WalletAmountRow
        inputRef={mockInputRef}
        value="100"
        placeholder="0"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={mockOnOverlayPress}
        onFocus={mockOnFocus}
        currency={WalletCurrency.Usd}
        balancePrimary="$100.00"
        balanceSecondary="10,000 sats"
      />,
    )

    expect(getByText("Dollar")).toBeTruthy()
    expect(getByText("$100.00")).toBeTruthy()
  })

  it("renders balanceSecondary with approximate prefix", () => {
    const { getByText } = render(
      <WalletAmountRow
        inputRef={mockInputRef}
        value="50"
        placeholder="0"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={mockOnOverlayPress}
        onFocus={mockOnFocus}
        currency={WalletCurrency.Usd}
        balancePrimary="$50.00"
        balanceSecondary="5,000 sats"
      />,
    )

    expect(getByText("~ 5,000 sats")).toBeTruthy()
  })

  it("does not render balanceSecondary when null", () => {
    const { queryByText } = render(
      <WalletAmountRow
        inputRef={mockInputRef}
        value="100"
        placeholder="0"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={mockOnOverlayPress}
        onFocus={mockOnFocus}
        currency={WalletCurrency.Btc}
        balancePrimary="1,000 sats"
        balanceSecondary={null}
      />,
    )

    expect(queryByText(/~/)).toBeNull()
  })

  it("renders placeholder when value is empty", () => {
    const { getByText } = render(
      <WalletAmountRow
        inputRef={mockInputRef}
        value=""
        placeholder="Enter amount"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={mockOnOverlayPress}
        onFocus={mockOnFocus}
        currency={WalletCurrency.Btc}
        balancePrimary="1,000 sats"
      />,
    )

    expect(getByText("Enter amount")).toBeTruthy()
  })
})
