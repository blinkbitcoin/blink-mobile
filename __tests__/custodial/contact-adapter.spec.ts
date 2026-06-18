import { renderHook, act } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

import { useCustodialContactAdapter } from "@app/custodial/contact-adapter"

const mockUseContactsQuery = jest.fn()
const mockUseUpdateAlias = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockRefetch = jest.fn()
const mockUpdateAlias = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useContactsQuery: (...args: unknown[]) => mockUseContactsQuery(...args),
  useUserContactUpdateAliasMutation: () => mockUseUpdateAlias(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const rawContacts = [
  { id: "c1", handle: "alice", username: "alice", alias: "Alice", transactionsCount: 3 },
  { id: "c2", handle: "bob", username: "bob", alias: "  ", transactionsCount: 1 },
  { id: "c3", handle: "carol", username: "carol", alias: null, transactionsCount: 0 },
]

describe("useCustodialContactAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseContactsQuery.mockReturnValue({
      data: { me: { contacts: rawContacts } },
      loading: false,
      refetch: mockRefetch,
    })
    mockUseUpdateAlias.mockReturnValue([mockUpdateAlias])
  })

  it("falls back to username when alias is empty or missing", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    const { contacts } = await result.current.list()

    expect(contacts).toEqual([
      {
        id: "c1",
        displayName: "Alice",
        paymentIdentifier: "alice",
        transactionsCount: 3,
        sourceAccountType: AccountType.Custodial,
      },
      {
        id: "c2",
        displayName: "bob",
        paymentIdentifier: "bob",
        transactionsCount: 1,
        sourceAccountType: AccountType.Custodial,
      },
      {
        id: "c3",
        displayName: "carol",
        paymentIdentifier: "carol",
        transactionsCount: 0,
        sourceAccountType: AccountType.Custodial,
      },
    ])
  })

  it("exposes capabilities reflecting that custodial is read-only for write operations", () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    expect(result.current.capabilities).toEqual({
      canAdd: false,
      canDelete: false,
      canEditPaymentIdentifier: false,
    })
  })

  it("rejects adding a contact", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    await expect(result.current.add({} as never)).rejects.toThrow(/do not support adding/)
  })

  it("rejects deleting a contact", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    await expect(result.current.delete("c1")).rejects.toThrow(/do not support deleting/)
  })

  it("rejects editing the payment identifier", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    await expect(
      result.current.update("c1", { paymentIdentifier: "new" }),
    ).rejects.toThrow(/do not support editing the payment identifier/)
  })

  it("returns the same contacts list when update has no displayName change", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    const updated = await result.current.update("c1", {})

    expect(updated.contacts).toHaveLength(3)
    expect(mockUpdateAlias).not.toHaveBeenCalled()
  })

  it("calls the alias mutation and refetches when displayName changes", async () => {
    mockRefetch.mockResolvedValue({ data: { me: { contacts: rawContacts } } })
    const { result } = renderHook(() => useCustodialContactAdapter())

    await act(async () => {
      await result.current.update("c1", { displayName: "New Alice" })
    })

    expect(mockUpdateAlias).toHaveBeenCalledWith({
      variables: { input: { username: "alice", alias: "New Alice" } },
    })
    expect(mockRefetch).toHaveBeenCalled()
  })

  it("rejects updating an unknown contact id", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    await expect(result.current.update("missing", { displayName: "x" })).rejects.toThrow(
      /Contact missing not found/,
    )
  })

  it("returns an empty transactions list (custodial does not back this)", async () => {
    const { result } = renderHook(() => useCustodialContactAdapter())

    const txs = await result.current.getTransactions("c1")

    expect(txs).toEqual([])
  })

  it("propagates the loading flag from the underlying query", () => {
    mockUseContactsQuery.mockReturnValue({
      data: undefined,
      loading: true,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useCustodialContactAdapter())

    expect(result.current.loading).toBe(true)
  })
})
