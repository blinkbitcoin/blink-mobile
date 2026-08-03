import * as React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

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

jest.mock("@app/components/transaction-item", () => ({
  MemoizedTransactionItem: ({ txid }: { txid: string }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID={`transaction-${txid}`} />
  },
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (args: unknown) => mockToastShow(args),
}))

/** Real translations so the section headers and empty state read like production. */
jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")

  return { useI18nContext: () => ({ LL: i18nObject("en"), locale: "en" }) }
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

const renderContactTransactions = () =>
  render(
    <ThemeProvider theme={theme}>
      <ContactTransactions contact={contact} />
    </ThemeProvider>,
  )

describe("ContactTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
