import { getAllKeys, loadJson, loadJsonOrThrow } from "@app/utils/storage"

const mockGetAllKeys = jest.fn()
const mockGetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
    getItem: (...args: unknown[]) => mockGetItem(...args),
  },
}))

describe("getAllKeys", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the stored keys", async () => {
    mockGetAllKeys.mockResolvedValue(["a", "b"])

    expect(await getAllKeys()).toEqual(["a", "b"])
  })

  it("returns null — not an empty list — when the listing fails", async () => {
    // An empty list is a fact about storage; a failure is the absence of one.
    // A sweep that cannot tell them apart marks itself complete having read
    // nothing, and never runs again.
    mockGetAllKeys.mockRejectedValue(new Error("storage unavailable"))

    expect(await getAllKeys()).toBeNull()
  })
})

describe("loadJson", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("parses the stored value", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ step: "backupAlerts" }))

    expect(await loadJson("key")).toEqual({ step: "backupAlerts" })
  })

  it("returns null when the key holds nothing", async () => {
    mockGetItem.mockResolvedValue(null)

    expect(await loadJson("key")).toBeNull()
  })
})

describe("loadJsonOrThrow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("parses the stored value", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ step: "balancesOverview" }))

    expect(await loadJsonOrThrow("key")).toEqual({ step: "balancesOverview" })
  })

  it("returns null when the key holds nothing", async () => {
    mockGetItem.mockResolvedValue(null)

    expect(await loadJsonOrThrow("key")).toBeNull()
  })

  it("throws when the read fails, instead of reporting an empty store", async () => {
    /** A caller that ends a flow on "nothing stored" must not be told that by a store it
     *  merely could not open (blink-wip#1211). */
    mockGetItem.mockRejectedValue(new Error("SQLITE_CORRUPT"))

    await expect(loadJsonOrThrow("key")).rejects.toThrow("SQLITE_CORRUPT")
  })

  it("reads unparseable content as absent, so the key stays replaceable", async () => {
    /** The opposite of a failed read: the store answered, and what it holds is
     *  definitively unusable. Throwing would leave the key unreadable and unwritable. */
    mockGetItem.mockResolvedValue("{ not json")

    expect(await loadJsonOrThrow("key")).toBeNull()
  })

  it("differs from loadJson, which reports both absent and unreadable as null", async () => {
    mockGetItem.mockRejectedValue(new Error("SQLITE_CORRUPT"))

    expect(await loadJson("key")).toBeNull()
    await expect(loadJsonOrThrow("key")).rejects.toThrow("SQLITE_CORRUPT")
  })
})
