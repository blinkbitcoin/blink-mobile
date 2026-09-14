import * as React from "react"
import { SectionList, StyleSheet } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import { TRANSACTION_LIST_WINDOW_SIZE } from "@app/components/transaction-item"
import { TxStatus, UserContact } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { ContactTransactions } from "@app/screens/people-screen/contacts/contact-transactions"
import { AccountType } from "@app/types/wallet"

const mockUseQuery = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockUseContactTransactions = jest.fn()
const mockLoadMore = jest.fn()
const mockActiveAccountType = jest.fn()
const mockToastShow = jest.fn()
const mockFragments = jest.fn()

const contactTransactions = (overrides: Record<string, unknown> = {}) => ({
  transactions: [],
  isLoading: false,
  hasError: false,
  loadMore: mockLoadMore,
  ...overrides,
})

/** An answered query: `data` present means the backend has spoken, empty edges or not. */
const custodialQuery = ({
  edges = [] as unknown[],
  pageInfo = { hasNextPage: false, endCursor: null },
  ...overrides
}: Record<string, unknown> = {}) => ({
  error: undefined,
  loading: false,
  fetchMore: jest.fn(),
  data: { me: { contactByUsername: { transactions: { edges, pageInfo } } } },
  ...overrides,
})

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTransactionListForContactQuery: (options: unknown) => mockUseQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockActiveAccountType() } }),
}))

jest.mock("@app/hooks/use-contact-transactions", () => ({
  useContactTransactions: (contactId: string, isEnabled: boolean) =>
    mockUseContactTransactions(contactId, isEnabled),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-transaction-fragments", () => ({
  useSelfCustodialTransactionFragments: (transactions: unknown) =>
    mockFragments(transactions),
}))

/** Records the props each row is handed, so the list's contract with the row is assertable. */
type RowProps = {
  txid: string
  onPress?: (txid: string) => void
  subtitle?: boolean
  isFirst?: boolean
  isLast?: boolean
}

const mockRowProps: RowProps[] = []

jest.mock("@app/components/transaction-item", () => ({
  ...jest.requireActual("@app/components/transaction-item"),
  MemoizedTransactionItem: ({ txid, onPress, subtitle, isFirst, isLast }: RowProps) => {
    const { View } = jest.requireActual("react-native")
    mockRowProps.push({ txid, onPress, subtitle, isFirst, isLast })
    return <View testID={`transaction-${txid}`} />
  },
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (args: unknown) => mockToastShow(args),
}))

/**
 * Real translations so the section headers and empty state read like production, resolved
 * once so `LL` keeps the stable identity the real context hands out.
 */
jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")
  const LL = i18nObject("en")

  return { useI18nContext: () => ({ LL, locale: "en" }) }
})

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(callback, [callback])
  },
}))

const contact: UserContact = {
  __typename: "UserContact",
  id: "contact-1",
  handle: "alice@blink.sv",
  username: "alice@blink.sv",
  alias: "Alice",
  transactionsCount: 2,
}

/** The radius the date group's card carries, mirrored from the screen's own token. */
const GROUP_RADIUS = 8

const makeFragment = (id: string) => ({
  __typename: "Transaction" as const,
  id,
  status: TxStatus.Success,
  createdAt: 1747691078,
  direction: "SEND",
  memo: null,
  settlementAmount: 100,
  settlementCurrency: "BTC",
})

/** A fresh element each call: re-rendering the same one lets React bail out entirely. */
const contactTransactionsScreen = () => (
  <ThemeProvider theme={theme}>
    <ContactTransactions contact={contact} />
  </ThemeProvider>
)

const renderContactTransactions = () => render(contactTransactionsScreen())

describe("ContactTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRowProps.length = 0
    mockUseIsAuthed.mockReturnValue(true)
    mockActiveAccountType.mockReturnValue(AccountType.Custodial)
    mockUseContactTransactions.mockReturnValue(contactTransactions())
    mockFragments.mockReturnValue([])
    mockUseQuery.mockReturnValue(custodialQuery())
  })

  describe("custodial account", () => {
    it("runs the contact query and lists what it returns", async () => {
      mockUseQuery.mockReturnValue(
        custodialQuery({ edges: [{ node: makeFragment("custodial-tx") }] }),
      )

      const { getByTestId } = renderContactTransactions()

      expect(getByTestId("transaction-custodial-tx")).toBeTruthy()
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
          variables: { username: contact.username },
        }),
      )
    })

    it("shows the empty state instead of a blank area when there is nothing", () => {
      const { getByTestId } = renderContactTransactions()

      expect(getByTestId("contact-no-transactions")).toBeTruthy()
    })

    it("spins while the query is still in flight", () => {
      mockUseQuery.mockReturnValue(custodialQuery({ loading: true }))

      const { getByTestId, queryByTestId } = renderContactTransactions()

      expect(getByTestId("contact-transactions-loading")).toBeTruthy()
      expect(queryByTestId("contact-no-transactions")).toBeNull()
    })

    it("does not claim a contact has no transactions before the query answers", () => {
      mockUseQuery.mockReturnValue(custodialQuery({ data: undefined }))

      const { getByTestId, queryByTestId } = renderContactTransactions()

      expect(getByTestId("contact-transactions-loading")).toBeTruthy()
      expect(queryByTestId("contact-no-transactions")).toBeNull()
    })

    it("does not spin forever on a query it never ran", () => {
      mockUseIsAuthed.mockReturnValue(false)
      mockUseQuery.mockReturnValue(custodialQuery({ data: undefined }))

      const { getByTestId, queryByTestId } = renderContactTransactions()

      expect(getByTestId("contact-no-transactions")).toBeTruthy()
      expect(queryByTestId("contact-transactions-loading")).toBeNull()
    })

    it("still holds its space when the history cannot be read", () => {
      // The toast carries the failure; the layout must not move under it, or the send
      // button climbs the screen on exactly the contact whose list is missing.
      mockUseQuery.mockReturnValue({
        error: new Error("network"),
        data: undefined,
        fetchMore: jest.fn(),
      })

      const { getByTestId, queryByTestId } = renderContactTransactions()

      expect(
        StyleSheet.flatten(getByTestId("contact-transactions-unavailable").props.style),
      ).toMatchObject({ flex: 1 })
      expect(queryByTestId("contact-transactions-list")).toBeNull()
    })

    it("reports a failed query through a toast", () => {
      mockUseQuery.mockReturnValue({
        error: new Error("network"),
        data: undefined,
        fetchMore: jest.fn(),
      })

      renderContactTransactions()

      expect(mockToastShow).toHaveBeenCalledTimes(1)

      loadLocale("en")
      const [{ message }] = mockToastShow.mock.calls[0]
      expect(message(i18nObject("en"))).toBe("Error loading transactions")
    })

    it("asks for the next page when the list reaches its end", async () => {
      const fetchMore = jest.fn()
      mockUseQuery.mockReturnValue(
        custodialQuery({
          fetchMore,
          edges: [{ node: makeFragment("custodial-tx") }],
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        }),
      )

      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).toHaveBeenCalledWith({
        variables: { username: contact.username, after: "cursor-1" },
      })
      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it("does not page past the last cursor", () => {
      const fetchMore = jest.fn()
      mockUseQuery.mockReturnValue(
        custodialQuery({ fetchMore, edges: [{ node: makeFragment("custodial-tx") }] }),
      )

      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).not.toHaveBeenCalled()
    })

    it("leaves the contact adapter switched off", () => {
      renderContactTransactions()

      expect(mockUseContactTransactions).toHaveBeenCalledWith(contact.handle, false)
    })
  })

  describe("self-custodial account", () => {
    beforeEach(() => {
      mockActiveAccountType.mockReturnValue(AccountType.SelfCustodial)
    })

    it("skips the custodial query, which has no session to resolve through", () => {
      renderContactTransactions()

      expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ skip: true }))
    })

    it("drives the adapter for this contact", () => {
      renderContactTransactions()

      expect(mockUseContactTransactions).toHaveBeenCalledWith(contact.handle, true)
    })

    it("lists the transactions the adapter returns", () => {
      mockUseContactTransactions.mockReturnValue(
        contactTransactions({ transactions: [{ id: "sc-tx" }] }),
      )
      mockFragments.mockImplementation((txs: unknown[]) =>
        txs.length ? [makeFragment("sc-tx")] : [],
      )

      const { getByTestId } = renderContactTransactions()

      expect(getByTestId("transaction-sc-tx")).toBeTruthy()
    })

    it("shows the empty state when the contact has no matching payments", () => {
      const { getByTestId } = renderContactTransactions()

      expect(getByTestId("contact-no-transactions")).toBeTruthy()
    })

    it("spins instead of claiming the contact has no payments", () => {
      mockUseContactTransactions.mockReturnValue(contactTransactions({ isLoading: true }))

      const { getByTestId, queryByTestId } = renderContactTransactions()

      expect(getByTestId("contact-transactions-loading")).toBeTruthy()
      expect(queryByTestId("contact-no-transactions")).toBeNull()
    })

    it("reports a failed adapter call through a toast", () => {
      mockUseContactTransactions.mockReturnValue(contactTransactions({ hasError: true }))

      const { queryByTestId } = renderContactTransactions()

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(queryByTestId("contact-transactions-list")).toBeNull()

      loadLocale("en")
      const [{ message }] = mockToastShow.mock.calls[0]
      expect(message(i18nObject("en"))).toBe("Error loading transactions")
    })

    it("does not toast again when the screen re-renders with the error still up", () => {
      mockUseContactTransactions.mockReturnValue(contactTransactions({ hasError: true }))

      const { rerender } = renderContactTransactions()
      rerender(contactTransactionsScreen())
      rerender(contactTransactionsScreen())

      expect(mockToastShow).toHaveBeenCalledTimes(1)
    })

    it("asks the adapter for the next page when the list reaches its end", () => {
      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(mockLoadMore).toHaveBeenCalledTimes(1)
    })

    it("never pages the custodial query, which has no session to resolve through", () => {
      const fetchMore = jest.fn()
      mockUseQuery.mockReturnValue({ error: undefined, data: undefined, fetchMore })

      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).not.toHaveBeenCalled()
    })
  })

  describe("list", () => {
    beforeEach(() => {
      mockUseQuery.mockReturnValue(
        custodialQuery({ edges: [{ node: makeFragment("custodial-tx") }] }),
      )
    })

    it("leaves its rows non-pressable", () => {
      /**
       * This list only shows the history with one contact; it does not navigate into a
       * transaction, and a row handed a handler here would look tappable and go nowhere.
       */
      renderContactTransactions()

      expect(mockRowProps.length).toBeGreaterThan(0)
      expect(mockRowProps.every((props) => props.onPress === undefined)).toBe(true)
    })

    it("hands the list the same render callbacks across re-renders", () => {
      /**
       * A fresh arrow per render defeats the row's React.memo, which is the whole point of
       * the memoization: every mounted row would re-render with it.
       */
      const screen = renderContactTransactions()
      const first = screen.UNSAFE_getByType(SectionList).props

      screen.rerender(contactTransactionsScreen())

      const second = screen.UNSAFE_getByType(SectionList).props

      expect(second.renderItem).toBe(first.renderItem)
      expect(second.keyExtractor).toBe(first.keyExtractor)
      expect(second.renderSectionHeader).toBe(first.renderSectionHeader)
    })

    it("bounds the mounted row set with the shared window size", () => {
      const screen = renderContactTransactions()

      expect(screen.UNSAFE_getByType(SectionList).props.windowSize).toBe(
        TRANSACTION_LIST_WINDOW_SIZE,
      )
    })

    it("holds the space below it, so what follows keeps its place", () => {
      // Whatever the contact's history holds, the list fills the room between the header
      // and the send button: a short one must not pull that button up the screen.
      const screen = renderContactTransactions()
      const list = screen.UNSAFE_getByType(SectionList)

      let container = list.parent
      while (container && typeof container.type !== "string") container = container.parent

      expect(StyleSheet.flatten(container?.props.style)).toMatchObject({ flex: 1 })
    })

    it("dates every row, so a payment is placed within its day", () => {
      renderContactTransactions()

      expect(mockRowProps.length).toBeGreaterThan(0)
      expect(mockRowProps.every((props) => props.subtitle)).toBe(true)
    })

    it("marks the ends of a date group, which carry its card edges", () => {
      mockUseQuery.mockReturnValue(
        custodialQuery({
          edges: [
            { node: makeFragment("first-tx") },
            { node: makeFragment("middle-tx") },
            { node: makeFragment("last-tx") },
          ],
        }),
      )

      renderContactTransactions()

      expect(
        mockRowProps.map(({ txid, isFirst, isLast }) => ({ txid, isFirst, isLast })),
      ).toEqual([
        { txid: "first-tx", isFirst: true, isLast: false },
        { txid: "middle-tx", isFirst: false, isLast: false },
        { txid: "last-tx", isFirst: false, isLast: true },
      ])
    })

    it("rounds the group's outer corners and nothing in between", () => {
      mockUseQuery.mockReturnValue(
        custodialQuery({
          edges: [
            { node: makeFragment("first-tx") },
            { node: makeFragment("middle-tx") },
            { node: makeFragment("last-tx") },
          ],
        }),
      )

      const { getByTestId } = renderContactTransactions()

      /** The row wraps in the view that carries the corners, past the row component. */
      const cornersOf = (txid: string) => {
        let node = getByTestId(`transaction-${txid}`).parent
        while (node && typeof node.type !== "string") node = node.parent
        return StyleSheet.flatten(node?.props.style)
      }

      expect(cornersOf("first-tx")).toEqual({
        borderTopLeftRadius: GROUP_RADIUS,
        borderTopRightRadius: GROUP_RADIUS,
        overflow: "hidden",
      })
      expect(cornersOf("middle-tx")).toEqual({})
      expect(cornersOf("last-tx")).toEqual({
        borderBottomLeftRadius: GROUP_RADIUS,
        borderBottomRightRadius: GROUP_RADIUS,
        overflow: "hidden",
      })
    })
  })
})
