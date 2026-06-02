import React from "react"
import { render } from "@testing-library/react-native"

import { PriceHistory } from "@app/components/price-history/price-history"

const mockUseBtcPriceListQuery = jest.fn()
const mockFormatMoneyAmount = jest.fn()

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useBtcPriceListQuery: (args: unknown) => mockUseBtcPriceListQuery(args),
  }
})

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: (args: unknown) => mockFormatMoneyAmount(args),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      PriceHistoryScreen: {
        satPrice: () => "sat-price",
        last24Hours: () => "Last 24 hours",
        lastWeek: () => "Last week",
        lastMonth: () => "Last month",
        lastYear: () => "Last year",
        lastFiveYears: () => "Last 5 years",
        oneDay: () => "1D",
        oneWeek: () => "1W",
        oneMonth: () => "1M",
        oneYear: () => "1Y",
        fiveYears: () => "5Y",
      },
    },
  }),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("victory-native", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  type CartesianChartProps = {
    children: (args: { points: { y: unknown[] } }) => React.ReactNode
  }
  return {
    CartesianChart: ({ children }: CartesianChartProps) =>
      ReactActual.createElement(
        View,
        { testID: "cartesian-chart" },
        children({ points: { y: [] } }),
      ),
    Line: () => null,
    useChartPressState: () => ({
      state: {
        x: { position: { value: 0 } },
        y: { y: { value: { value: 0 }, position: { value: 0 } } },
      },
      isActive: false,
    }),
  }
})

jest.mock("@shopify/react-native-skia", () => ({
  Circle: () => null,
}))

jest.mock("react-native-reanimated", () => {
  const ReactActual = jest.requireActual("react")
  const { TextInput } = jest.requireActual("react-native")

  type Factory<T> = () => T
  const useDerivedValue = <T,>(factory: Factory<T>) => ({ value: factory() })
  const useAnimatedProps = <T,>(factory: Factory<T>) => factory()

  type AnimatedComponentProps = {
    value?: string
    style?: unknown
    testID?: string
  }

  const createAnimatedComponent = () => (props: AnimatedComponentProps) =>
    ReactActual.createElement(TextInput, { ...props, editable: false })

  return {
    __esModule: true,
    default: {
      createAnimatedComponent,
      addWhitelistedNativeProps: jest.fn(),
    },
    createAnimatedComponent,
    useDerivedValue,
    useAnimatedProps,
    addWhitelistedNativeProps: jest.fn(),
  }
})

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  const { Text: RNText } = jest.requireActual("react-native")
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({
          colors: {
            primary: "#fc5805",
            black: "#000",
            red: "#f00",
            _green: "#0f0",
            grey3: "#999",
            transparent: "transparent",
          },
        }),
    useTheme: () => ({
      theme: {
        colors: {
          primary: "#fc5805",
          black: "#000",
          red: "#f00",
          _green: "#0f0",
          grey3: "#999",
          transparent: "transparent",
        },
      },
    }),
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(RNText, null, children),
  }
})

jest.mock("@rn-vui/base", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      ReactActual.createElement(
        TouchableOpacity,
        { onPress, testID: `range-${title}` },
        ReactActual.createElement(Text, null, title),
      ),
  }
})

const makePricePoint = (timestamp: number, base: number) => ({
  __typename: "PricePoint" as const,
  timestamp,
  price: { base, offset: 4, currencyUnit: "USDCENT" },
})

describe("PriceHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFormatMoneyAmount.mockImplementation(
      ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
        `$${moneyAmount.amount.toFixed(2)}`,
    )
  })

  it("renders the latest price as the visible price text", () => {
    mockUseBtcPriceListQuery.mockReturnValue({
      loading: false,
      data: {
        btcPriceList: [
          makePricePoint(1700000000, 800_000_000),
          makePricePoint(1700100000, 1_000_000_000),
        ],
      },
    })

    const { getByTestId, getAllByDisplayValue } = render(<PriceHistory />)

    // The wrapping View carries the satPrice testID; the AnimatedText sits inside.
    expect(getByTestId("sat-price")).toBeTruthy()

    // The latest price (base=1_000_000_000, offset=4 -> 100000) must reach the TextInput.
    expect(getAllByDisplayValue("$100000.00").length).toBeGreaterThan(0)
  })

  it("renders an empty price string while loading", () => {
    mockUseBtcPriceListQuery.mockReturnValue({ loading: true, data: undefined })

    const { getAllByDisplayValue } = render(<PriceHistory />)

    expect(getAllByDisplayValue("").length).toBeGreaterThan(0)
  })

  it("still surfaces the latest price even when intermediate prices are null", () => {
    mockUseBtcPriceListQuery.mockReturnValue({
      loading: false,
      data: {
        btcPriceList: [
          makePricePoint(1700000000, 500_000_000),
          null,
          makePricePoint(1700100000, 1_200_000_000),
        ],
      },
    })

    const { getAllByDisplayValue } = render(<PriceHistory />)

    // 1_200_000_000 / 10^4 = 120000
    expect(getAllByDisplayValue("$120000.00").length).toBeGreaterThan(0)
  })
})
