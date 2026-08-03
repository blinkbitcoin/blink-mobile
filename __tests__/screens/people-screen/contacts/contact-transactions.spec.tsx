import * as React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { flushEffects } from "../../../helpers/flush-effects"

import { ThemeProvider } from "@rn-vui/themed"

import { TxStatus, UserContact } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { ContactTransactions } from "@app/screens/people-screen/contacts/contact-transactions"
import { AccountType } from "@app/types/wallet"

const mockUseQuery = jest.fn()
const mockGetTransactions = jest.fn()
const mockContactsLoading = jest.fn()
const mockActiveAccountType = jest.fn()
const mockToastShow = jest.fn()
const mockFragments = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTransactionListForContactQuery: (options: unknown) => mockUseQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockActiveAccountType() } }),
}))

jest.mock("@app/hooks/use-contacts", () => ({
  useContacts: () => ({
    getTransactions: mockGetTransactions,
    loading: mockContactsLoading(),
  }),
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
    mockActiveAccountType.mockReturnValue(AccountType.Custodial)
    mockContactsLoading.mockReturnValue(false)
    mockGetTransactions.mockResolvedValue([])
    mockFragments.mockReturnValue([])
    mockUseQuery.mockReturnValue({
      error: undefined,
      data: undefined,
      fetchMore: jest.fn(),
    })
  })

  describe("custodial account", () => {
    it("runs the contact query and lists what it returns", async () => {
      mockUseQuery.mockReturnValue({
        error: undefined,
        fetchMore: jest.fn(),
        data: {
          me: {
            contactByUsername: {
              transactions: {
                edges: [{ node: makeFragment("custodial-tx") }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      })

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
      mockUseQuery.mockReturnValue({
        error: undefined,
        fetchMore,
        data: {
          me: {
            contactByUsername: {
              transactions: {
                edges: [{ node: makeFragment("custodial-tx") }],
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              },
            },
          },
        },
      })

      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).toHaveBeenCalledWith({
        variables: { username: contact.username, after: "cursor-1" },
      })
    })

    it("does not page past the last cursor", () => {
      const fetchMore = jest.fn()
      mockUseQuery.mockReturnValue({
        error: undefined,
        fetchMore,
        data: {
          me: {
            contactByUsername: {
              transactions: {
                edges: [{ node: makeFragment("custodial-tx") }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      })

      const { getByTestId } = renderContactTransactions()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).not.toHaveBeenCalled()
    })

    it("does not ask the contact adapter for transactions", () => {
      renderContactTransactions()

      expect(mockGetTransactions).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial account", () => {
    beforeEach(() => {
      mockActiveAccountType.mockReturnValue(AccountType.SelfCustodial)
    })

    it("skips the custodial query, which has no session to resolve through", async () => {
      renderContactTransactions()
      await flushEffects()

      expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ skip: true }))
    })

    it("lists the transactions the contact adapter returns", async () => {
      const normalized = [{ id: "sc-tx" }]
      mockGetTransactions.mockResolvedValue(normalized)
      mockFragments.mockImplementation((txs: unknown[]) =>
        txs.length ? [makeFragment("sc-tx")] : [],
      )

      const { getByTestId } = renderContactTransactions()
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalledWith(contact.id)
      expect(getByTestId("transaction-sc-tx")).toBeTruthy()
    })

    it("shows the empty state when the contact has no matching payments", async () => {
      const { getByTestId } = renderContactTransactions()
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalledWith(contact.id)
      expect(getByTestId("contact-no-transactions")).toBeTruthy()
    })

    it("ignores a late adapter answer after it unmounts", async () => {
      let resolveTransactions: (value: unknown[]) => void = () => {}
      mockGetTransactions.mockReturnValue(
        new Promise((resolve) => {
          resolveTransactions = resolve
        }),
      )

      const { unmount } = renderContactTransactions()
      unmount()
      resolveTransactions([{ id: "late-tx" }])
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalled()
      expect(mockFragments).not.toHaveBeenCalledWith([{ id: "late-tx" }])
    })

    it("ignores a late adapter failure after it unmounts", async () => {
      let rejectTransactions: (reason: Error) => void = () => {}
      mockGetTransactions.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectTransactions = reject
        }),
      )

      const { unmount } = renderContactTransactions()
      unmount()
      rejectTransactions(new Error("sdk unavailable"))
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("does not page, because the adapter answers without a cursor", async () => {
      const fetchMore = jest.fn()
      mockUseQuery.mockReturnValue({ error: undefined, data: undefined, fetchMore })

      const { getByTestId } = renderContactTransactions()
      await flushEffects()
      fireEvent(getByTestId("contact-transactions-list"), "endReached")

      expect(fetchMore).not.toHaveBeenCalled()
    })

    describe("while the adapter is still answering", () => {
      it("waits for the contact list before asking for transactions", () => {
        mockContactsLoading.mockReturnValue(true)

        renderContactTransactions()

        expect(mockGetTransactions).not.toHaveBeenCalled()
      })

      it("spins instead of claiming the contact has no payments", () => {
        mockContactsLoading.mockReturnValue(true)

        const { getByTestId, queryByTestId } = renderContactTransactions()

        expect(getByTestId("contact-transactions-loading")).toBeTruthy()
        expect(queryByTestId("contact-no-transactions")).toBeNull()
      })

      it("keeps spinning until the adapter answers", async () => {
        mockGetTransactions.mockReturnValue(new Promise(() => {}))

        const { getByTestId, queryByTestId } = renderContactTransactions()
        await flushEffects()

        expect(mockGetTransactions).toHaveBeenCalledWith(contact.id)
        expect(getByTestId("contact-transactions-loading")).toBeTruthy()
        expect(queryByTestId("contact-no-transactions")).toBeNull()
      })
    })

    it("reports a failed adapter call through a toast", async () => {
      mockGetTransactions.mockRejectedValue(new Error("sdk unavailable"))

      const { queryByTestId } = renderContactTransactions()
      await flushEffects()

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(queryByTestId("contact-transactions-list")).toBeNull()

      loadLocale("en")
      const [{ message }] = mockToastShow.mock.calls[0]
      expect(message(i18nObject("en"))).toBe("Error loading transactions")
    })

    it("clears a previous failure when the contact changes", async () => {
      mockGetTransactions.mockRejectedValueOnce(new Error("sdk unavailable"))

      const { queryByTestId, rerender } = renderContactTransactions()
      await flushEffects()

      expect(queryByTestId("contact-transactions-list")).toBeNull()

      mockGetTransactions.mockResolvedValue([])
      rerender(
        <ThemeProvider theme={theme}>
          <ContactTransactions contact={{ ...contact, id: "contact-2" }} />
        </ThemeProvider>,
      )
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalledWith("contact-2")
      expect(queryByTestId("contact-no-transactions")).toBeTruthy()
    })
  })
})
