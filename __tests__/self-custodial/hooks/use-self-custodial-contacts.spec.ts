import { renderHook, act, waitFor } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

import { useSelfCustodialContacts } from "@app/self-custodial/hooks/use-self-custodial-contacts"

const mockListContacts = jest.fn()
const mockFindOrCreateContact = jest.fn()
const mockUpdateContact = jest.fn()
const mockDeleteContact = jest.fn()
const mockFetchContactPaymentsPage = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({}))

jest.mock("@app/self-custodial/bridge", () => ({
  listContacts: (...args: unknown[]) => mockListContacts(...args),
  findOrCreateContact: (...args: unknown[]) => mockFindOrCreateContact(...args),
  updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
}))

jest.mock("@app/self-custodial/providers/contact-payments", () => ({
  fetchContactPaymentsPage: (...args: unknown[]) => mockFetchContactPaymentsPage(...args),
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
    mockFetchContactPaymentsPage.mockResolvedValue({
      transactions: [],
      rawOffset: 0,
      hasMore: false,
    })
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
  })

  it("loads contacts from the SDK on mount and exposes them via list()", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    let contacts: Awaited<ReturnType<typeof result.current.list>>["contacts"] = []
    await act(async () => {
      ;({ contacts } = await result.current.list())
    })
    expect(contacts).toEqual(expectedContacts)
  })

  it("stops loading and skips the SDK call when sdk is null", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useSelfCustodialContacts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockListContacts).not.toHaveBeenCalled()
  })

  it("list() answers with nothing while the wallet is not connected", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let contacts: Awaited<ReturnType<typeof result.current.list>>["contacts"] = []
    await act(async () => {
      ;({ contacts } = await result.current.list())
    })

    expect(contacts).toEqual([])
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

  it("update() keeps the name when only the payment identifier changes", async () => {
    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.update("c1", { paymentIdentifier: "alice@other.sv" })
    })

    expect(mockUpdateContact).toHaveBeenCalledWith(mockSdk, {
      id: "c1",
      name: "Alice",
      paymentIdentifier: "alice@other.sv",
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

  it("getTransactions() returns an exhausted page when the wallet is not connected", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const page = await result.current.getTransactions("alice@blink.sv")

    expect(page).toEqual({ transactions: [], nextCursor: null })
    expect(mockFetchContactPaymentsPage).not.toHaveBeenCalled()
  })

  it("getTransactions() asks for the payments from the start of the history", async () => {
    mockFetchContactPaymentsPage.mockResolvedValue({
      transactions: [{ id: "tx-1" }],
      rawOffset: 20,
      hasMore: true,
    })

    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const page = await result.current.getTransactions("alice@blink.sv")

    expect(mockFetchContactPaymentsPage).toHaveBeenCalledWith(
      mockSdk,
      "alice@blink.sv",
      0,
    )
    expect(page).toEqual({ transactions: [{ id: "tx-1" }], nextCursor: "20" })
  })

  it("getTransactions() resumes from the cursor it handed out", async () => {
    mockFetchContactPaymentsPage.mockResolvedValue({
      transactions: [],
      rawOffset: 60,
      hasMore: false,
    })

    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const page = await result.current.getTransactions("alice@blink.sv", "40")

    expect(mockFetchContactPaymentsPage).toHaveBeenCalledWith(
      mockSdk,
      "alice@blink.sv",
      40,
    )
    expect(page.nextCursor).toBeNull()
  })

  it("getTransactions() restarts rather than passing a cursor it did not issue", async () => {
    mockFetchContactPaymentsPage.mockResolvedValue({
      transactions: [],
      rawOffset: 0,
      hasMore: false,
    })

    const { result } = renderHook(() => useSelfCustodialContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.getTransactions("alice@blink.sv", "not-a-number")

    expect(mockFetchContactPaymentsPage).toHaveBeenCalledWith(
      mockSdk,
      "alice@blink.sv",
      0,
    )
  })

  it("holds no contacts when the first read fails, and stops loading", async () => {
    // A failed read leaves the screen with nothing to match against rather than a
    // half-populated list, and must not spin forever.
    mockListContacts.mockRejectedValue(new Error("sdk unavailable"))

    const { result } = renderHook(() => useSelfCustodialContacts())

    await waitFor(() => expect(result.current.loading).toBe(false))
    await expect(result.current.update("c1", { displayName: "Alice 2" })).rejects.toThrow(
      /Contact c1 not found/,
    )
  })

  it("ignores a read that answers after it unmounts", async () => {
    let rejectRead: (error: Error) => void = () => {}
    mockListContacts.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRead = reject
      }),
    )

    const { unmount } = renderHook(() => useSelfCustodialContacts())
    unmount()

    await act(async () => {
      rejectRead(new Error("late"))
    })

    expect(mockListContacts).toHaveBeenCalledWith(mockSdk)
  })
})
