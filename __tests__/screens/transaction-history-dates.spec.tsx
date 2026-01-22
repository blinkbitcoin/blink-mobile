process.env.TZ = "UTC"

import React from "react"
import { InteractionManager } from "react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { NavigationContainer, RouteProp } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { ThemeProvider } from "@rn-vui/themed"
import { cleanup, render, waitFor } from "@testing-library/react-native"

import mocks from "@app/graphql/mocks"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TransactionHistoryScreen } from "@app/screens/transaction-history"
import {
  TransactionListForDefaultAccountDocument,
  TxLastSeenDocument,
} from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { detectDefaultLocale } from "@app/utils/locale-detector"
import { createCache } from "@app/graphql/cache"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"

import { StoryScreen } from "../../.storybook/views"

let currentMocks: MockedResponse[] = []
const DEFAULT_ACCOUNT_ID = "account-id"
const Stack = createStackNavigator()

jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((callback) => {
  if (typeof callback === "function") {
    callback()
  }

  return {
    cancel: () => {},
  } as ReturnType<typeof InteractionManager.runAfterInteractions>
})

const BTC_WALLET_ID = "e821e124-1c70-4aab-9416-074ee5be21f6"
const USD_WALLET_ID = "5b54bf9a-46cc-4344-b638-b5e5e157a892"

const mockRouteWithCurrencyFilter = (): RouteProp<
  RootStackParamList,
  "transactionHistory"
> => ({
  key: "transactionHistory-test",
  name: "transactionHistory",
  params: {
    wallets: [
      {
        id: BTC_WALLET_ID,
        walletCurrency: "BTC",
      },
      {
        id: USD_WALLET_ID,
        walletCurrency: "USD",
      },
    ],
  },
})

const buildTransactionMocks = (
  edges: Array<{
    __typename: "TransactionEdge"
    cursor: string
    node: {
      __typename: "Transaction"
      id: string
      status: "SUCCESS"
      direction: "RECEIVE"
      memo: null
      createdAt: number
      settlementAmount: number
      settlementFee: number
      settlementDisplayFee: string
      settlementCurrency: "BTC"
      settlementDisplayAmount: string
      settlementDisplayCurrency: "USD"
      settlementPrice: {
        __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit"
        base: number
        offset: number
        currencyUnit: "MINOR"
        formattedAmount: string
      }
      initiationVia: {
        __typename: "InitiationViaLn"
        paymentHash: string
        paymentRequest: string
      }
      settlementVia: {
        __typename: "SettlementViaIntraLedger"
        counterPartyWalletId: null
        counterPartyUsername: string
        preImage: null
      }
    }
  }>,
): MockedResponse[] => {
  const wallets = [
    {
      __typename: "BTCWallet",
      id: BTC_WALLET_ID,
      balance: 0,
      walletCurrency: "BTC",
    },
    {
      __typename: "UsdWallet",
      id: USD_WALLET_ID,
      balance: 0,
      walletCurrency: "USD",
    },
  ]

  const result = {
    data: {
      me: {
        __typename: "User",
        id: "user-id",
        defaultAccount: {
          __typename: "ConsumerAccount",
          id: DEFAULT_ACCOUNT_ID,
          wallets,
          pendingIncomingTransactions: [],
          transactions: {
            __typename: "TransactionConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: "cursor-1",
              endCursor: "cursor-1",
            },
            edges,
          },
        },
      },
    },
  }

  return [
    {
      request: {
        query: TransactionListForDefaultAccountDocument,
        variables: {
          first: 21,
          walletIds: [BTC_WALLET_ID, USD_WALLET_ID],
        },
      },
      result,
    },
  ]
}

const makeEdge = (id: string, createdAt: number) => ({
  __typename: "TransactionEdge" as const,
  cursor: `cursor-${id}`,
  node: {
    __typename: "Transaction" as const,
    id,
    status: "SUCCESS" as const,
    direction: "RECEIVE" as const,
    memo: null,
    createdAt,
    settlementAmount: 1000,
    settlementFee: 0,
    settlementDisplayFee: "0.00",
    settlementCurrency: "BTC" as const,
    settlementDisplayAmount: "0.10",
    settlementDisplayCurrency: "USD" as const,
    settlementPrice: {
      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit" as const,
      base: 105000000000,
      offset: 12,
      currencyUnit: "MINOR" as const,
      formattedAmount: "0.105",
    },
    initiationVia: {
      __typename: "InitiationViaLn" as const,
      paymentHash: `hash-${id}`,
      paymentRequest: `payment-request-${id}`,
    },
    settlementVia: {
      __typename: "SettlementViaIntraLedger" as const,
      counterPartyWalletId: null,
      counterPartyUsername: `user-${id}`,
      preImage: null,
    },
  },
})

const createTestCache = () => {
  const cache = createCache()

  cache.writeQuery({
    query: TxLastSeenDocument,
    variables: { accountId: DEFAULT_ACCOUNT_ID },
    data: {
      __typename: "Query",
      txLastSeen: {
        __typename: "TxLastSeen",
        accountId: DEFAULT_ACCOUNT_ID,
        btcId: "",
        usdId: "",
      },
    },
  })

  return cache
}

const ContextForHistory: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home">
          {() => (
            <MockedProvider mocks={currentMocks} cache={createTestCache()}>
              <StoryScreen>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <IsAuthedContextProvider value={true}>
                    {children}
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </StoryScreen>
            </MockedProvider>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
)

describe("TransactionHistoryScreen date formatting", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-01-20T12:00:00Z"))
  })

  afterEach(() => {
    cleanup()
    currentMocks = []
    jest.useRealTimers()
  })

  it("shows relative dates for today/yesterday and short dates for older groups", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    const edges = [
      makeEdge("tx-today-1", nowSeconds - 5),
      makeEdge("tx-today-2", nowSeconds - 2 * 60 * 60),
      makeEdge("tx-today-3", nowSeconds - 45 * 60),
      makeEdge("tx-yesterday-1", nowSeconds - 18 * 60 * 60),
      makeEdge("tx-yesterday-2", nowSeconds - 20 * 60 * 60),
      makeEdge("tx-yesterday-3", nowSeconds - 30 * 60 * 60),
      makeEdge("tx-older-1", Math.floor(Date.parse("2026-01-18T12:00:00Z") / 1000)),
      makeEdge("tx-older-2", Math.floor(Date.parse("2026-01-10T12:00:00Z") / 1000)),
      makeEdge("tx-older-3", Math.floor(Date.parse("2025-12-31T12:00:00Z") / 1000)),
      makeEdge("tx-older-4", Math.floor(Date.parse("2025-12-01T12:00:00Z") / 1000)),
      makeEdge("tx-older-5", Math.floor(Date.parse("2025-11-15T12:00:00Z") / 1000)),
    ]

    currentMocks = [...buildTransactionMocks(edges), ...mocks]

    const screen = render(
      <ContextForHistory>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForHistory>,
    )

    await waitFor(() => {
      expect(screen.getAllByTestId("transaction-by-index-0").length).toBeGreaterThan(0)
    })

    expect(await screen.findByText("5 seconds ago")).toBeTruthy()
    expect(await screen.findByText("45 minutes ago")).toBeTruthy()
    expect(await screen.findByText("2 hours ago")).toBeTruthy()
    expect(await screen.findByText("18 hours ago")).toBeTruthy()
    expect(await screen.findByText("20 hours ago")).toBeTruthy()

    const yesterdayMatch = await screen.findAllByText(/yesterday|1 day ago/i)
    expect(yesterdayMatch.length).toBeGreaterThan(0)

    expect(await screen.findByText("2026-01-18")).toBeTruthy()
    expect(await screen.findByText("2026-01-10")).toBeTruthy()
    expect(await screen.findByText("2025-12-31")).toBeTruthy()
  })
})
