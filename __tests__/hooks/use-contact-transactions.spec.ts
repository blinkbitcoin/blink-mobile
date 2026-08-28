import { act, renderHook } from "@testing-library/react-native"

import { useContactTransactions } from "@app/hooks/use-contact-transactions"

import { flushEffects } from "../helpers/flush-effects"

const mockGetTransactions = jest.fn()
const mockContactsLoading = jest.fn()

/** Held on an object so a test can swap the reader the way a reconnect does. */
const mockContactAdapter = { getTransactions: mockGetTransactions }

jest.mock("@app/hooks/use-contacts", () => ({
  useContacts: () => ({
    getTransactions: mockContactAdapter.getTransactions,
    loading: mockContactsLoading(),
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(callback, [callback])
  },
}))

const page = (ids: string[], nextCursor: string | null) => ({
  transactions: ids.map((id) => ({ id })),
  nextCursor,
})

const IDENTIFIER = "alice@blink.sv"

const renderContactTransactions = (isEnabled = true, identifier = IDENTIFIER) =>
  renderHook(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      useContactTransactions(id, enabled),
    { initialProps: { id: identifier, enabled: isEnabled } },
  )

/** Loads a first page and leaves a cursor pointing at the next one. */
const renderWithFirstPage = async () => {
  mockGetTransactions.mockResolvedValueOnce(page(["tx-1"], "20"))
  const rendered = renderContactTransactions()
  await flushEffects()
  return rendered
}

describe("useContactTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockContactsLoading.mockReturnValue(false)
    mockContactAdapter.getTransactions = mockGetTransactions
    mockGetTransactions.mockResolvedValue(page([], null))
  })

  it("loads the first page for the contact's payment identifier", async () => {
    mockGetTransactions.mockResolvedValue(page(["tx-1"], null))

    const { result } = renderContactTransactions()
    await flushEffects()

    expect(mockGetTransactions).toHaveBeenCalledWith(IDENTIFIER)
    expect(result.current.transactions).toEqual([{ id: "tx-1" }])
    expect(result.current.isLoading).toBe(false)
  })

  it("stays out of the way when it is not the active source", async () => {
    const { result } = renderContactTransactions(false)
    await flushEffects()

    expect(mockGetTransactions).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it("reads without waiting on a contact list it never consults", async () => {
    mockContactsLoading.mockReturnValue(true)
    mockGetTransactions.mockResolvedValue(page(["tx-1"], null))

    const { result } = renderContactTransactions()
    await flushEffects()

    expect(mockGetTransactions).toHaveBeenCalledWith(IDENTIFIER)
    expect(result.current.transactions).toEqual([{ id: "tx-1" }])
  })

  it("re-reads when the adapter reconnects and hands over a new reader", async () => {
    mockGetTransactions.mockResolvedValue(page([], null))

    const { rerender } = renderContactTransactions()
    await flushEffects()
    expect(mockGetTransactions).toHaveBeenCalledTimes(1)

    const reconnectedGetTransactions = jest.fn().mockResolvedValue(page(["tx-1"], null))
    mockContactAdapter.getTransactions = reconnectedGetTransactions
    rerender({ id: IDENTIFIER, enabled: true })
    await flushEffects()

    expect(reconnectedGetTransactions).toHaveBeenCalledWith(IDENTIFIER)
  })

  describe("a page that holds nothing for this contact", () => {
    it("keeps reading, because an empty list has no scroll to ask with", async () => {
      mockGetTransactions
        .mockResolvedValueOnce(page([], "20"))
        .mockResolvedValueOnce(page([], "40"))
        .mockResolvedValueOnce(page(["tx-1"], null))

      const { result } = renderContactTransactions()
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalledTimes(3)
      expect(mockGetTransactions).toHaveBeenLastCalledWith(IDENTIFIER, "40")
      expect(result.current.transactions).toEqual([{ id: "tx-1" }])
    })

    it("reads as loading while it is still searching", async () => {
      mockGetTransactions.mockResolvedValueOnce(page([], "20"))
      mockGetTransactions.mockReturnValue(new Promise(() => {}))

      const { result } = renderContactTransactions()
      await flushEffects()

      expect(result.current.isLoading).toBe(true)
    })

    it("settles on the empty state once the history runs out", async () => {
      mockGetTransactions
        .mockResolvedValueOnce(page([], "20"))
        .mockResolvedValueOnce(page([], null))

      const { result } = renderContactTransactions()
      await flushEffects()

      expect(mockGetTransactions).toHaveBeenCalledTimes(2)
      expect(result.current.transactions).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it("stops searching, rather than spinning on, when a page fails", async () => {
      mockGetTransactions.mockResolvedValueOnce(page([], "20"))
      mockGetTransactions.mockRejectedValue(new Error("sdk unavailable"))

      const { result } = renderContactTransactions()
      await flushEffects()

      expect(result.current.hasError).toBe(true)
    })
  })

  it("reports a failed first page through hasError", async () => {
    mockGetTransactions.mockRejectedValue(new Error("sdk unavailable"))

    const { result } = renderContactTransactions()
    await flushEffects()

    expect(result.current.hasError).toBe(true)
  })

  it("drops the previous contact's payments the moment it is pointed at another", async () => {
    const { result, rerender } = await renderWithFirstPage()
    expect(result.current.transactions).toEqual([{ id: "tx-1" }])

    mockGetTransactions.mockReturnValue(new Promise(() => {}))
    rerender({ id: "bob@blink.sv", enabled: true })

    expect(result.current.transactions).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  describe("loadMore", () => {
    it("appends the next page and follows the cursor it was handed", async () => {
      const { result } = await renderWithFirstPage()

      mockGetTransactions.mockResolvedValueOnce(page(["tx-2"], "40"))
      await act(async () => {
        result.current.loadMore()
      })

      expect(mockGetTransactions).toHaveBeenLastCalledWith(IDENTIFIER, "20")
      expect(result.current.transactions).toEqual([{ id: "tx-1" }, { id: "tx-2" }])
    })

    it("drops a repeat of a transaction an earlier page already listed", async () => {
      const { result } = await renderWithFirstPage()

      mockGetTransactions.mockResolvedValueOnce(page(["tx-1", "tx-2"], null))
      await act(async () => {
        result.current.loadMore()
      })

      expect(result.current.transactions).toEqual([{ id: "tx-1" }, { id: "tx-2" }])
    })

    it("does nothing once the history is exhausted", async () => {
      mockGetTransactions.mockResolvedValue(page(["tx-1"], null))
      const { result } = renderContactTransactions()
      await flushEffects()
      mockGetTransactions.mockClear()

      await act(async () => {
        result.current.loadMore()
      })

      expect(mockGetTransactions).not.toHaveBeenCalled()
    })

    it("ignores a second call while the first is still in flight", async () => {
      const { result } = await renderWithFirstPage()

      mockGetTransactions.mockClear()
      mockGetTransactions.mockReturnValue(new Promise(() => {}))
      await act(async () => {
        result.current.loadMore()
        result.current.loadMore()
      })

      expect(mockGetTransactions).toHaveBeenCalledTimes(1)
    })

    it("keeps the list a failed page did not touch, and lets the next scroll retry", async () => {
      const { result } = await renderWithFirstPage()

      mockGetTransactions.mockRejectedValueOnce(new Error("sdk unavailable"))
      await act(async () => {
        result.current.loadMore()
      })

      expect(result.current.hasError).toBe(false)
      expect(result.current.transactions).toEqual([{ id: "tx-1" }])

      mockGetTransactions.mockResolvedValueOnce(page(["tx-2"], null))
      await act(async () => {
        result.current.loadMore()
      })

      expect(result.current.transactions).toEqual([{ id: "tx-1" }, { id: "tx-2" }])
    })

    it("discards a page that lands after the first page was re-read", async () => {
      const { result, rerender } = await renderWithFirstPage()

      let resolveStalePage: (value: unknown) => void = () => {}
      mockGetTransactions.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStalePage = resolve
        }),
      )
      act(() => {
        result.current.loadMore()
      })

      /** Re-reading the first page invalidates the cursor the in-flight call was using. */
      mockGetTransactions.mockResolvedValueOnce(page(["tx-9"], "20"))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      await act(async () => {
        resolveStalePage(page(["stale-tx"], "40"))
      })

      expect(result.current.transactions).toEqual([{ id: "tx-9" }])
    })

    it("can page again after the first page was re-read", async () => {
      const { result, rerender } = await renderWithFirstPage()

      mockGetTransactions.mockReturnValueOnce(new Promise(() => {}))
      act(() => {
        result.current.loadMore()
      })

      mockGetTransactions.mockResolvedValueOnce(page(["tx-9"], "20"))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      mockGetTransactions.mockResolvedValueOnce(page(["tx-10"], null))
      await act(async () => {
        result.current.loadMore()
      })

      expect(result.current.transactions).toEqual([{ id: "tx-9" }, { id: "tx-10" }])
    })
  })

  describe("a first page that lands after another was asked for", () => {
    it("does not overwrite the contact that replaced it", async () => {
      let resolveSlowPage: (value: unknown) => void = () => {}
      mockGetTransactions.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSlowPage = resolve
        }),
      )

      const { result, rerender } = renderContactTransactions()
      await flushEffects()

      mockGetTransactions.mockResolvedValueOnce(page(["bob-tx"], null))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      await act(async () => {
        resolveSlowPage(page(["alice-tx"], "20"))
      })

      expect(result.current.transactions).toEqual([{ id: "bob-tx" }])
    })

    it("does not mark the contact that replaced it as loaded", async () => {
      let resolveSlowPage: (value: unknown) => void = () => {}
      mockGetTransactions.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSlowPage = resolve
        }),
      )

      const { result, rerender } = renderContactTransactions()
      await flushEffects()

      mockGetTransactions.mockReturnValueOnce(new Promise(() => {}))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      await act(async () => {
        resolveSlowPage(page(["alice-tx"], "20"))
      })

      expect(result.current.isLoading).toBe(true)
    })

    it("does not fail the contact that replaced it when a later page rejects", async () => {
      const { result, rerender } = await renderWithFirstPage()

      let rejectStalePage: (reason: Error) => void = () => {}
      mockGetTransactions.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectStalePage = reject
        }),
      )
      act(() => {
        result.current.loadMore()
      })

      mockGetTransactions.mockResolvedValueOnce(page(["bob-tx"], null))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      await act(async () => {
        rejectStalePage(new Error("sdk unavailable"))
      })

      expect(result.current.hasError).toBe(false)
      expect(result.current.transactions).toEqual([{ id: "bob-tx" }])
    })

    it("does not fail the contact that replaced it", async () => {
      let rejectSlowPage: (reason: Error) => void = () => {}
      mockGetTransactions.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectSlowPage = reject
        }),
      )

      const { result, rerender } = renderContactTransactions()
      await flushEffects()

      mockGetTransactions.mockResolvedValueOnce(page(["bob-tx"], null))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      await act(async () => {
        rejectSlowPage(new Error("sdk unavailable"))
      })

      expect(result.current.hasError).toBe(false)
    })

    it("does not leave the replacing contact stuck loading", async () => {
      mockGetTransactions.mockReturnValueOnce(new Promise(() => {}))

      const { result, rerender } = renderContactTransactions()
      await flushEffects()
      expect(result.current.isLoading).toBe(true)

      mockGetTransactions.mockResolvedValueOnce(page(["bob-tx"], null))
      rerender({ id: "bob@blink.sv", enabled: true })
      await flushEffects()

      expect(result.current.isLoading).toBe(false)
    })
  })
})
