import React from "react"
import { it } from "@jest/globals"
import { MockedResponse } from "@apollo/client/testing"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { HomeScreen } from "../../app/screens/home-screen"
import { ContextForScreen } from "./helper"
import {
  AccountLevel,
  HomeAuthedDocument,
  HomeUnauthedDocument,
  Network,
} from "@app/graphql/generated"

let currentMocks: MockedResponse[] = []

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  isIos: true,
}))

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")

  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmount: ({ amount }: { amount: number }) => ({
        amount,
        currency: "DisplayCurrency",
        currencyCode: "USD",
      }),
    }),
  }
})

jest.mock("@app/graphql/mocks", () => ({
  __esModule: true,
  get default() {
    return currentMocks
  },
}))

jest.mock("@app/components/slide-up-handle", () => {
  const React = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")

  type Props = {
    onAction: () => void
    testID?: string
  }

  const MockSlideUpHandle = ({ onAction, testID = "slide-up-handle" }: Props) => (
    <TouchableOpacity testID={testID} onPress={onAction}>
      <Text>Slide up</Text>
    </TouchableOpacity>
  )

  return { __esModule: true, default: MockSlideUpHandle }
})

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: mockNavigate,
    }),
  }
})

jest.mock("@react-native-firebase/app-check", () => {
  return () => ({
    initializeAppCheck: jest.fn(),
    getToken: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: jest.fn(),
    }),
  })
})

jest.mock("react-native-config", () => {
  return {
    APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
    APP_CHECK_IOS_DEBUG_TOKEN: "token",
  }
})

export const generateHomeMock = ({
  level,
  network,
  btcBalance,
  usdBalance,
}: {
  level: AccountLevel
  network: Network
  btcBalance: number
  usdBalance: number
}): MockedResponse[] => {
  return [
    {
      request: { query: HomeUnauthedDocument },
      result: {
        data: {
          __typename: "Query",
          globals: {
            __typename: "Globals",
            network,
          },
          currencyList: [],
        },
      },
    },
    {
      request: { query: HomeAuthedDocument },
      result: {
        data: {
          me: {
            __typename: "User",
            id: "user-id",
            defaultAccount: {
              __typename: "ConsumerAccount",
              id: "account-id",
              level,
              defaultWalletId: "btc-wallet",
              wallets: [
                {
                  __typename: "BTCWallet",
                  id: "btc-wallet",
                  balance: btcBalance,
                  walletCurrency: "BTC",
                },
                {
                  __typename: "UsdWallet",
                  id: "usd-wallet",
                  balance: usdBalance,
                  walletCurrency: "USD",
                },
              ],
              transactions: {
                __typename: "TransactionConnection",
                edges: [],
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: false,
                  hasPreviousPage: false,
                  startCursor: null,
                  endCursor: null,
                },
              },
              pendingIncomingTransactions: [],
            },
          },
        },
      },
    },
  ]
}

type ConvertButtonCase = {
  description: string
  isIos: boolean
  level: AccountLevel
  network: Network
  btcBalance: number
  usdBalance: number
  expectConvertButton: boolean
}

const iosCases: ConvertButtonCase[] = [
  {
    description: "iOS + mainnet + ONE + no balance --> hidden",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: false,
  },
  {
    description: "iOS + mainnet + ONE + has balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 1000,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + mainnet + TWO + no balance --> shown",
    isIos: true,
    level: AccountLevel.Two,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + mainnet + THREE + no balance --> shown",
    isIos: true,
    level: AccountLevel.Three,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + signet + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Signet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + regtest + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Regtest,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "iOS + testnet + ONE + no balance --> shown",
    isIos: true,
    level: AccountLevel.One,
    network: Network.Testnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
]

const androidCases: ConvertButtonCase[] = [
  {
    description: "Android + signet + ONE + no balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Signet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "Android + regtest + ONE + has balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Regtest,
    btcBalance: 0,
    usdBalance: 5000,
    expectConvertButton: true,
  },
  {
    description: "Android + signet + TWO + has balance --> shown",
    isIos: false,
    level: AccountLevel.Two,
    network: Network.Signet,
    btcBalance: 2000,
    usdBalance: 0,
    expectConvertButton: true,
  },
  {
    description: "Android + regtest + THREE + has balance --> shown",
    isIos: false,
    level: AccountLevel.Three,
    network: Network.Regtest,
    btcBalance: 3000,
    usdBalance: 3000,
    expectConvertButton: true,
  },
  {
    description: "Android + mainnet + ONE + no balance --> shown",
    isIos: false,
    level: AccountLevel.One,
    network: Network.Mainnet,
    btcBalance: 0,
    usdBalance: 0,
    expectConvertButton: true,
  },
]

describe("HomeScreen", () => {
  beforeEach(() => {
    currentMocks = []
    jest.clearAllMocks()
  })

  it("HomeAuthed", async () => {
    render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )
    await act(async () => {})
  })

  it.each([...iosCases, ...androidCases] satisfies ConvertButtonCase[])(
    "%s",
    async ({ isIos, level, network, btcBalance, usdBalance, expectConvertButton }) => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos,
      }))

      currentMocks = generateHomeMock({ level, network, btcBalance, usdBalance })

      const { getByTestId } = render(
        <ContextForScreen>
          <HomeScreen />
        </ContextForScreen>,
      )

      if (expectConvertButton) {
        await waitFor(() => expect(getByTestId("transfer")).toBeTruthy())
        return
      }

      await waitFor(() => expect(() => getByTestId("transfer")).toThrow())
    },
  )

  it("Slide-up handle triggers navigation to transaction history", async () => {
    mockNavigate.mockClear()

    const { getByTestId } = render(
      <ContextForScreen>
        <HomeScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByTestId("slide-up-handle"))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("transactionHistory", {
        showLoading: true,
      }),
    )
  })
})
