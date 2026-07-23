import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import { createCache } from "@app/graphql/cache"
import { FeeRatesDocument } from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { FeeRatesScreen } from "@app/screens/settings-screen/fee-rates-screen"
import { detectDefaultLocale } from "@app/utils/locale-detector"

import { ContextForScreen } from "../helper"

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
  })

  it("renders Send, Receive and Transfer sections with remote-config default rates", async () => {
    const { getByText, getAllByText, findByText } = render(
      <ContextForScreen>
        <FeeRatesScreen />
      </ContextForScreen>,
    )

    expect(getByText("Send")).toBeTruthy()
    expect(getByText("Receive")).toBeTruthy()
    expect(getByText("Transfer")).toBeTruthy()

    expect(getByText("Lightning")).toBeTruthy()
    expect(getByText("0.2% + ~0.1% routing fee")).toBeTruthy()
    expect(getAllByText("no fee")).toHaveLength(2)
    expect(getByText("from ~0.9%")).toBeTruthy()
    expect(getByText("from ~0.6%")).toBeTruthy()
    expect(getByText("from ~0.4%")).toBeTruthy()

    expect(getByText("Transfer fee")).toBeTruthy()
    expect(getByText("0.35%")).toBeTruthy()

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

    expect(getByText("0.2% + ~0.1% routing fee")).toBeTruthy()
    expect(getByText("0.35%")).toBeTruthy()
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
                  ratio: "50",
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

  it("renders a zero over-threshold fee when the API reports a zero ratio", async () => {
    const zeroRatioMocks = [
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
                  ratio: "0",
                },
              },
            },
          },
        },
      },
    ]

    const { findByText } = renderWithApolloMocks(zeroRatioMocks)

    expect(await findByText("2,500 SAT")).toBeTruthy()
    expect(await findByText("0 SAT")).toBeTruthy()
  })
})
