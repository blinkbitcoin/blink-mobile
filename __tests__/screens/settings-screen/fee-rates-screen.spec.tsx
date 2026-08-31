import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import { createCache } from "@app/graphql/cache"
import { defaultFeeRatesConfig, FeeRatesConfig } from "@app/config/feature-flags-context"
import { FeeRatesDocument } from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { FeeRatesScreen } from "@app/screens/settings-screen/fee-rates-screen"
import { detectDefaultLocale } from "@app/utils/locale-detector"

import { ContextForScreen } from "../helper"

let mockFeeRatesConfig: FeeRatesConfig
jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ feeRatesConfig: mockFeeRatesConfig }),
}))

const Stack = createNativeStackNavigator()

const renderWithApolloMocks = (apolloMocks: ReadonlyArray<MockedResponse>) =>
  render(
    <ThemeProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">
            {() => (
              <MockedProvider mocks={apolloMocks} cache={createCache()}>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <FeeRatesScreen />
                </TypesafeI18n>
              </MockedProvider>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  )

describe("FeeRatesScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockFeeRatesConfig = { ...defaultFeeRatesConfig }
  })

  it("renders Send, Receive and Transfer sections with remote-config default rates", async () => {
    const { getByText, getAllByText, queryByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(getByText("Send")).toBeTruthy()
    expect(getByText("Receive")).toBeTruthy()
    expect(getByText("Transfer")).toBeTruthy()

    expect(getByText("Lightning")).toBeTruthy()
    expect(getAllByText("no fee")).toHaveLength(4)
    expect(getByText("from ~0.9%")).toBeTruthy()
    expect(queryByText("Onchain Standard (~4h)")).toBeNull()
    expect(queryByText("Onchain Economy (~24h)")).toBeNull()

    expect(getByText("Transfer fee")).toBeTruthy()
    expect(getByText("0.5%")).toBeTruthy()

    await findByText("2,500 SAT")
  })

  it("shows the lightning send fee once remote config sets non-zero rates", async () => {
    mockFeeRatesConfig = {
      ...defaultFeeRatesConfig,
      lightningSendBps: 20,
      lightningRoutingBps: 10,
    }

    const { getByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(getByText("0.2% + ~0.1% routing fee")).toBeTruthy()

    await findByText("2,500 SAT")
  })

  it("shows onchain standard and economy tiers when remote config enables them", async () => {
    mockFeeRatesConfig = {
      ...defaultFeeRatesConfig,
      onchainStandardBps: 60,
      onchainEconomyBps: 40,
    }

    const { getByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(getByText("Onchain Standard (~4h)")).toBeTruthy()
    expect(getByText("from ~0.6%")).toBeTruthy()
    expect(getByText("Onchain Economy (~24h)")).toBeTruthy()
    expect(getByText("from ~0.4%")).toBeTruthy()

    await findByText("2,500 SAT")
  })

  it("pairs the free lightning threshold row with a no-fee value", async () => {
    const { getAllByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    // Labels and values render in tree order, so the value belonging to a row
    // is the entry immediately after its label.
    const cells = getAllByText(/^(Lightning below 100 SAT|Intraledger|no fee)$/).map(
      (node) => node.children.join(""),
    )
    const labelIndex = cells.indexOf("Lightning below 100 SAT")

    expect(labelIndex).toBeGreaterThanOrEqual(0)
    expect(cells[labelIndex + 1]).toBe("no fee")

    await findByText("2,500 SAT")
  })

  it("renders every Send row in the order the design specifies", async () => {
    mockFeeRatesConfig = {
      ...defaultFeeRatesConfig,
      onchainStandardBps: 60,
      onchainEconomyBps: 40,
    }

    const { getAllByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    // Anchored so "Lightning transactions" in the Receive section cannot match.
    const sendLabels = getAllByText(
      /^(Lightning|Lightning below 100 SAT|Intraledger|Onchain Priority \(~10m\)|Onchain Standard \(~4h\)|Onchain Economy \(~24h\))$/,
    ).map((node) => node.children.join(""))

    expect(sendLabels).toEqual([
      "Lightning",
      "Lightning below 100 SAT",
      "Intraledger",
      "Onchain Priority (~10m)",
      "Onchain Standard (~4h)",
      "Onchain Economy (~24h)",
    ])

    await findByText("2,500 SAT")
  })

  it("hides the free lightning threshold row when lightning sends are hidden", async () => {
    mockFeeRatesConfig = { ...defaultFeeRatesConfig, lightningSendBps: -1 }

    const { queryByText, getByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(queryByText("Lightning")).toBeNull()
    expect(queryByText("Lightning below 100 SAT")).toBeNull()
    expect(getByText("Intraledger")).toBeTruthy()

    await findByText("2,500 SAT")
  })

  it("hides the whole Transfer section when remote config sets a negative rate", async () => {
    mockFeeRatesConfig = { ...defaultFeeRatesConfig, transferBps: -1 }

    const { queryByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(queryByText("Transfer")).toBeNull()
    expect(queryByText("Transfer fee")).toBeNull()

    await findByText("2,500 SAT")
  })

  it("renders onchain receive fees from the API", async () => {
    const { findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(await findByText("Onchain below 1M SAT")).toBeTruthy()
    expect(await findByText("Onchain above 1M SAT")).toBeTruthy()
    expect(await findByText("2,500 SAT")).toBeTruthy()
    expect(await findByText("5,000 SAT")).toBeTruthy()
  })

  it("shows a loading indicator for onchain receive fees while the query is in flight", async () => {
    const { getByTestId, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(getByTestId("fee-rates-loading")).toBeTruthy()

    await findByText("2,500 SAT")
  })

  it("keeps remote-config sections and shows an inline error when the query fails", async () => {
    const errorMocks = [
      {
        request: { query: FeeRatesDocument },
        error: new Error("network error"),
      },
    ]

    const { getByText, findByText } = renderWithApolloMocks(errorMocks)

    expect(await findByText("Unable to fetch fees at this time")).toBeTruthy()
    expect(getByText("Try Again")).toBeTruthy()

    expect(getByText("from ~0.9%")).toBeTruthy()
    expect(getByText("0.5%")).toBeTruthy()
  })

  it("recovers via Try Again after a failed query", async () => {
    const errorThenSuccessMocks = [
      {
        request: { query: FeeRatesDocument },
        error: new Error("network error"),
      },
      {
        request: { query: FeeRatesDocument },
        result: {
          data: {
            globals: {
              __typename: "Globals",
              feesInformation: {
                __typename: "FeesInformation",
                deposit: {
                  __typename: "DepositFeesInformation",
                  minBankFee: "2500",
                  minBankFeeThreshold: "1000000",
                  tiers: [
                    {
                      __typename: "DepositFeeTier",
                      maxAmount: "1000000",
                      amount: "2500",
                    },
                    { __typename: "DepositFeeTier", maxAmount: null, amount: "5000" },
                  ],
                },
              },
            },
          },
        },
      },
    ]

    const { findByText, queryByText } = renderWithApolloMocks(errorThenSuccessMocks)

    fireEvent.press(await findByText("Try Again"))

    expect(await findByText("2,500 SAT")).toBeTruthy()
    expect(queryByText("Unable to fetch fees at this time")).toBeNull()
  })

  it("renders a row per tier when the API returns more than two", async () => {
    const threeTierMocks = [
      {
        request: { query: FeeRatesDocument },
        result: {
          data: {
            globals: {
              __typename: "Globals",
              feesInformation: {
                __typename: "FeesInformation",
                deposit: {
                  __typename: "DepositFeesInformation",
                  minBankFee: "2500",
                  minBankFeeThreshold: "1000000",
                  tiers: [
                    {
                      __typename: "DepositFeeTier",
                      maxAmount: "1000000",
                      amount: "2500",
                    },
                    {
                      __typename: "DepositFeeTier",
                      maxAmount: "5000000",
                      amount: "4000",
                    },
                    { __typename: "DepositFeeTier", maxAmount: null, amount: "5000" },
                  ],
                },
              },
            },
          },
        },
      },
    ]

    const { findByText } = renderWithApolloMocks(threeTierMocks)

    expect(await findByText("Onchain below 1M SAT")).toBeTruthy()
    expect(await findByText("Onchain between 1M and 5M SAT")).toBeTruthy()
    expect(await findByText("Onchain above 5M SAT")).toBeTruthy()
    expect(await findByText("4,000 SAT")).toBeTruthy()
  })

  it("renders a zero over-threshold fee when the unbounded tier is free", async () => {
    const zeroOverFeeMocks = [
      {
        request: { query: FeeRatesDocument },
        result: {
          data: {
            globals: {
              __typename: "Globals",
              feesInformation: {
                __typename: "FeesInformation",
                deposit: {
                  __typename: "DepositFeesInformation",
                  minBankFee: "2500",
                  minBankFeeThreshold: "1000000",
                  tiers: [
                    {
                      __typename: "DepositFeeTier",
                      maxAmount: "1000000",
                      amount: "2500",
                    },
                    { __typename: "DepositFeeTier", maxAmount: null, amount: "0" },
                  ],
                },
              },
            },
          },
        },
      },
    ]

    const { findByText } = renderWithApolloMocks(zeroOverFeeMocks)

    expect(await findByText("2,500 SAT")).toBeTruthy()
    expect(await findByText("0 SAT")).toBeTruthy()
  })
})
