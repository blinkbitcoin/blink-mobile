import { renderHook, act, waitFor } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

import { useSelfCustodialContacts } from "@app/self-custodial/hooks/use-self-custodial-contacts"

const mockListContacts = jest.fn()
const mockFindOrCreateContact = jest.fn()
const mockUpdateContact = jest.fn()
const mockDeleteContact = jest.fn()
const mockListPayments = jest.fn()
const mockMapTransactions = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  // eslint-disable-next-line camelcase
  PaymentDetails_Tags: { Lightning: "Lightning", Spark: "Spark" },
  PaymentType: { Send: "Send", Receive: "Receive" },
}))

jest.mock("@app/self-custodial/bridge", () => ({
  listContacts: (...args: unknown[]) => mockListContacts(...args),
  findOrCreateContact: (...args: unknown[]) => mockFindOrCreateContact(...args),
  updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
  listPayments: (...args: unknown[]) => mockListPayments(...args),
}))

jest.mock("@app/self-custodial/mappers/transaction", () => ({
  mapSelfCustodialTransactions: (...args: unknown[]) => mockMapTransactions(...args),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const sdkContacts = [
  { id: "c1", name: "Alice", paymentIdentifier: "alice@blink.sv" },
  { id: "c2", name: "Bob", paymentIdentifier: "bob@blink.sv" },
]

const expectedContacts = [
  {
    id: "c1",
    displayName: "Alice",
    paymentIdentifier: "alice@blink.sv",
    transactionsCount: 0,
    sourceAccountType: AccountType.SelfCustodial,
  },
  {
    id: "c2",
    displayName: "Bob",
    paymentIdentifier: "bob@blink.sv",
    transactionsCount: 0,
    sourceAccountType: AccountType.SelfCustodial,
  },
]

const mockSdk = { id: "sdk" }

describe("useSelfCustodialContacts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListContacts.mockResolvedValue(sdkContacts)
    mockFindOrCreateContact.mockResolvedValue(undefined)
    mockUpdateContact.mockResolvedValue(undefined)
    mockDeleteContact.mockResolvedValue(undefined)
    mockListPayments.mockResolvedValue({ payments: [] })
    mockMapTransactions.mockReturnValue([])
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
  })

  it("loads contacts from the SDK on mount and exposes them via list()", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { contacts } = await result.current.list()
    expect(contacts).toEqual(expectedContacts)
  })

  it("stops loading and skips the SDK call when sdk is null", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useSelfCustodialContacts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockListContacts).not.toHaveBeenCalled()
  })

  it("exposes full write capabilities", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.capabilities).toEqual({
      canAdd: true,
      canDelete: true,
      canEditPaymentIdentifier: true,
    })
  })

  it("forwards add() to the SDK and refreshes the list", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.add({
        displayName: "Carol",
        paymentIdentifier: "carol@blink.sv",
      } as never)
    })

    expect(mockFindOrCreateContact).toHaveBeenCalledWith(
      mockSdk,
      "carol@blink.sv",
      "Carol",
    )
    expect(mockListContacts).toHaveBeenCalledTimes(2) // initial + refresh after add
  })

  it("rejects add() when the SDK is unavailable", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      result.current.add({ displayName: "x", paymentIdentifier: "y" } as never),
    ).rejects.toThrow(/not ready/)
  })

  it("update() merges existing values when changes omit fields", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.update("c1", { displayName: "Alice 2" })
    })

    expect(mockUpdateContact).toHaveBeenCalledWith(mockSdk, {
      id: "c1",
      name: "Alice 2",
      paymentIdentifier: "alice@blink.sv",
    })
  })

  it("update() rejects when the contact id is unknown", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.update("missing", { displayName: "x" })).rejects.toThrow(
      /Contact missing not found/,
    )
  })

  it("delete() forwards the id to the SDK", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.delete("c1")
    })

    expect(mockDeleteContact).toHaveBeenCalledWith(mockSdk, "c1")
  })

  it("getTransactions() returns an empty list when the contact id is unknown", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const txs = await result.current.getTransactions("missing")

    expect(txs).toEqual([])
    expect(mockListPayments).not.toHaveBeenCalled()
  })

  it("getTransactions() filters payments to those matching the contact's lnAddress", async () => {
    const matchingPayment = {
      paymentType: "Send",
      details: {
        tag: "Lightning",
        inner: { lnurlPayInfo: { lnAddress: "ALICE@BLINK.SV" } },
      },
    }
    const nonMatchingPayment = {
      paymentType: "Send",
      details: {
        tag: "Lightning",
        inner: { lnurlPayInfo: { lnAddress: "stranger@blink.sv" } },
      },
    }
    const sparkPayment = {
      paymentType: "Send",
      details: { tag: "Spark", inner: {} },
    }
    mockListPayments.mockResolvedValue({
      payments: [matchingPayment, nonMatchingPayment, sparkPayment],
    })

    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.getTransactions("c1")

    expect(mockMapTransactions).toHaveBeenCalledWith([matchingPayment])
  })
})
