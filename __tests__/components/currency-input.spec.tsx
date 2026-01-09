import React from "react"
import { Text as ReactNativeText, TextInput } from "react-native"
import { render } from "@testing-library/react-native"

import { CurrencyInput } from "@app/components/currency-input/currency-input"

jest.mock("@rn-vui/themed", () => ({
  Text: (() => {
    const MockText = (props: React.ComponentProps<typeof ReactNativeText>) => (
      <ReactNativeText {...props} />
    )

    MockText.displayName = "MockText"

    return MockText
  })(),
  Input: (() => {
    const MockInput = React.forwardRef(
      (
        {
          value,
          placeholder,
          onFocus: _onFocus,
          testID,
        }: {
          value: string
          placeholder: string
          onFocus?: () => void
          testID?: string
        },
        _ref: React.Ref<TextInput>,
      ) => <ReactNativeText testID={testID}>{value || placeholder}</ReactNativeText>,
    )

    MockInput.displayName = "MockInput"

    return MockInput
  })(),
  useTheme: () => ({
    theme: {
      colors: {
        grey2: "grey2",
        grey5: "grey5",
        grey1: "grey1",
      },
    },
  }),
  makeStyles: () => () => ({
    containerBase: {},
    contentContainer: {},
    inputSection: {},
    inputOverlay: {},
    inputText: {},
    inputContainer: {},
    rightIconBox: {},
    rightIconSpacer: {},
    currencyBadge: {},
    currencyText: {},
  }),
}))

describe("CurrencyInput", () => {
  const mockOnChangeText = jest.fn()
  const inputRef = React.createRef<TextInput>()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders with value and currency", () => {
    const { getByText } = render(
      <CurrencyInput
        value="100"
        currency="USD"
        onChangeText={mockOnChangeText}
        inputRef={inputRef}
      />,
    )

    expect(getByText("100")).toBeTruthy()
    expect(getByText("USD")).toBeTruthy()
  })

  it("renders placeholder when value is empty", () => {
    const { getByText } = render(
      <CurrencyInput
        value=""
        placeholder="Enter amount"
        currency="BTC"
        onChangeText={mockOnChangeText}
        inputRef={inputRef}
      />,
    )

    expect(getByText("Enter amount")).toBeTruthy()
    expect(getByText("BTC")).toBeTruthy()
  })

  it("displays currency badge", () => {
    const { getByText } = render(
      <CurrencyInput
        value="50"
        currency="EUR"
        onChangeText={mockOnChangeText}
        inputRef={inputRef}
      />,
    )

    expect(getByText("EUR")).toBeTruthy()
  })

  it("renders with testId prop", () => {
    const { getByTestId } = render(
      <CurrencyInput
        value="100"
        currency="USD"
        onChangeText={mockOnChangeText}
        inputRef={inputRef}
        testId="currency-input-test"
      />,
    )

    expect(getByTestId("currency-input-test")).toBeTruthy()
  })

  it("renders without testId when not provided", () => {
    const result = render(
      <CurrencyInput
        value="100"
        currency="USD"
        onChangeText={mockOnChangeText}
        inputRef={inputRef}
      />,
    )

    expect(result).toBeTruthy()
  })
})
