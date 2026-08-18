import React from "react"
import { SectionList } from "react-native"
import { MockedResponse } from "@apollo/client/testing"
import { render, waitFor } from "@testing-library/react-native"

import { ContactTransactions } from "@app/screens/people-screen/contacts/contact-transactions"
import { TransactionListForContactDocument } from "@app/graphql/generated"
import { TRANSACTION_LIST_WINDOW_SIZE } from "@app/components/transaction-item"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../helper"

const CONTACT_USERNAME = "test_contact"

let currentMocks: MockedResponse[] = []

jest.mock("@app/graphql/mocks", () => {
  const actual = jest.requireActual("@app/graphql/mocks")
  return {
    __esModule: true,
    get default() {
      // Spec-specific mocks first so they take precedence; the shared mocks
      // backfill every other query fired by mounted components, keeping
      // Apollo's MockLink warning-free.
      return [...currentMocks, ...actual.default]
    },
  }
})

// Records the props each row is handed, so the list's contract with the row
// (one shared handler, or none at all) is assertable from here.
const mockRowProps: Array<{ txid: string; onPress?: (txid: string) => void }> = []

jest.mock("@app/components/transaction-item", () => {
  const actual = jest.requireActual("@app/components/transaction-item")
  const React = jest.requireActual("react")
  const { Text } = jest.requireActual("react-native")

  type Props = { txid: string; onPress?: (txid: string) => void }

  const MemoizedTransactionItem = ({ txid, onPress }: Props) => {
    mockRowProps.push({ txid, onPress })
    return React.createElement(Text, { testID: `row-${txid}` }, txid)
  }

  return {
    __esModule: true,
    ...actual,
    MemoizedTransactionItem,
  }
})

const makeEdge = (id: string, cursor: string, createdAt: number) => ({
  __typename: "TransactionEdge",
  cursor,
  node: {
    __typename: "Transaction",
    id,
    status: "SUCCESS",
    direction: "RECEIVE",
    memo: null,
    createdAt,
    settlementAmount: 1000,
    settlementFee: 0,
    settlementDisplayFee: "0.00",
    settlementCurrency: "BTC",
    settlementDisplayAmount: "0.10",
    settlementDisplayCurrency: "USD",
    settlementPrice: {
      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
      base: 105000000000,
      offset: 12,
      currencyUnit: "MINOR",
      formattedAmount: "0.105",
    },
    initiationVia: {
      __typename: "InitiationViaLn",
      paymentHash: `hash-${id}`,
      paymentRequest: `payment-request-${id}`,
    },
    settlementVia: {
      __typename: "SettlementViaIntraLedger",
      counterPartyWalletId: null,
      counterPartyUsername: CONTACT_USERNAME,
      preImage: null,
    },
  },
})

const buildContactMocks = (): MockedResponse[] => {
  const result = {
    data: {
      me: {
        __typename: "User",
        id: "user-id",
        contactByUsername: {
          __typename: "UserContact",
          transactions: {
            __typename: "TransactionConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: "cursor-1",
              endCursor: "cursor-2",
            },
            edges: [
              makeEdge("507f1f77bcf86cd799439011", "cursor-1", 1700000001),
              makeEdge("507f1f77bcf86cd799439012", "cursor-2", 1700000000),
            ],
          },
        },
      },
    },
  }

  return [
    {
      request: {
        query: TransactionListForContactDocument,
        variables: { username: CONTACT_USERNAME },
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
      result,
    },
  ]
}

const renderContactTransactions = () =>
  render(
    <ContextForScreen>
      <ContactTransactions contactUsername={CONTACT_USERNAME} />
    </ContextForScreen>,
  )

describe("ContactTransactions", () => {
  beforeEach(() => {
    loadLocale("en")
    mockRowProps.length = 0
    currentMocks = buildContactMocks()
  })

  it("renders a row per transaction of the contact", async () => {
    const screen = renderContactTransactions()

    await waitFor(() => {
      expect(screen.getByTestId("row-507f1f77bcf86cd799439011")).toBeTruthy()
    })
    expect(screen.getByTestId("row-507f1f77bcf86cd799439012")).toBeTruthy()
  })

  it("leaves its rows non-pressable", async () => {
    // This list only shows the history with one contact; it does not navigate
    // into a transaction, and a row handed a handler here would look tappable
    // and go nowhere.
    const screen = renderContactTransactions()

    await waitFor(() => {
      expect(screen.getByTestId("row-507f1f77bcf86cd799439011")).toBeTruthy()
    })

    expect(mockRowProps.length).toBeGreaterThan(0)
    expect(mockRowProps.every((props) => props.onPress === undefined)).toBe(true)
  })

  it("hands the list the same render callbacks across re-renders", async () => {
    // A fresh arrow per render defeats the row's React.memo, which is the whole
    // point of the memoization: every mounted row would re-render with it.
    const screen = renderContactTransactions()

    await waitFor(() => {
      expect(screen.getByTestId("row-507f1f77bcf86cd799439011")).toBeTruthy()
    })

    const first = screen.UNSAFE_getByType(SectionList).props

    screen.rerender(
      <ContextForScreen>
        <ContactTransactions contactUsername={CONTACT_USERNAME} />
      </ContextForScreen>,
    )

    const second = screen.UNSAFE_getByType(SectionList).props

    expect(second.renderItem).toBe(first.renderItem)
    expect(second.keyExtractor).toBe(first.keyExtractor)
    expect(second.renderSectionHeader).toBe(first.renderSectionHeader)
  })

  it("bounds the mounted row set with the shared window size", async () => {
    const screen = renderContactTransactions()

    await waitFor(() => {
      expect(screen.getByTestId("row-507f1f77bcf86cd799439011")).toBeTruthy()
    })

    expect(screen.UNSAFE_getByType(SectionList).props.windowSize).toBe(
      TRANSACTION_LIST_WINDOW_SIZE,
    )
  })
})
