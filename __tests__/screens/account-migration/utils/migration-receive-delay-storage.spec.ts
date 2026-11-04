/** Mocks AsyncStorage rather than the storage wrapper, so the real best-effort helpers take
 *  part: what this module promises is exactly what those helpers do with a failure. */
const mockStore = new Map<string, string>()
const mockGetItem = jest.fn(async (key: string) => mockStore.get(key) ?? null)

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value)
    },
    removeItem: async (key: string) => {
      mockStore.delete(key)
    },
  },
}))

import {
  clearReceiveDelayedSince,
  getReceiveDelayedSinceKey,
  loadReceiveDelayedSince,
  saveReceiveDelayedSince,
} from "@app/screens/account-migration/utils/migration-receive-delay-storage"

describe("migration-receive-delay-storage", () => {
  beforeEach(() => {
    mockStore.clear()
    mockGetItem.mockClear()
  })

  it("reads back the moment it saved, for the same wallet", async () => {
    await saveReceiveDelayedSince("sc-1", 1_700_000_000_000)

    await expect(loadReceiveDelayedSince("sc-1")).resolves.toBe(1_700_000_000_000)
  })

  /** The wait belongs to one migration's wallet: another one starts its own window. */
  it("lends nothing to another wallet", async () => {
    await saveReceiveDelayedSince("sc-1", 1_700_000_000_000)

    await expect(loadReceiveDelayedSince("sc-2")).resolves.toBeNull()
  })

  it("reads a value it cannot use as none", async () => {
    mockStore.set(getReceiveDelayedSinceKey("sc-1"), JSON.stringify("soon"))

    await expect(loadReceiveDelayedSince("sc-1")).resolves.toBeNull()
  })

  it("forgets the moment once cleared", async () => {
    await saveReceiveDelayedSince("sc-1", 1_700_000_000_000)
    await clearReceiveDelayedSince("sc-1")

    await expect(loadReceiveDelayedSince("sc-1")).resolves.toBeNull()
  })

  /** Best effort: all an unreadable store can cost is a window started over. */
  it("reads an unreadable store as none rather than throwing", async () => {
    await saveReceiveDelayedSince("sc-1", 1_700_000_000_000)
    mockGetItem.mockRejectedValueOnce(new Error("Database Error"))

    await expect(loadReceiveDelayedSince("sc-1")).resolves.toBeNull()
  })
})
