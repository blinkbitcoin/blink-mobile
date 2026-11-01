import {
  getAllKeys,
  loadJson,
  loadJsonOrThrow,
  loadString,
  readString,
  remove,
  removeOrThrow,
} from "@app/utils/storage"

const mockGetAllKeys = jest.fn()
const mockGetItem = jest.fn()
const mockRemoveItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
    getItem: (...args: unknown[]) => mockGetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}))

/** The removal pair, told apart the way the read pair is: one swallows, one tells. */
describe("removeOrThrow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("removes the key", async () => {
    mockRemoveItem.mockResolvedValue(undefined)

    await removeOrThrow("a")

    expect(mockRemoveItem).toHaveBeenCalledWith("a")
  })

  it("propagates a removal that failed", async () => {
    mockRemoveItem.mockRejectedValue(new Error("Database Error"))

    await expect(removeOrThrow("a")).rejects.toThrow("Database Error")
  })

  /** The contrast that makes the new helper necessary. */
  it("is what tells a failed removal apart from the best-effort remove", async () => {
    mockRemoveItem.mockRejectedValue(new Error("Database Error"))
    jest.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(remove("a")).resolves.toBeUndefined()
  })
})

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

describe("readString", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reports a stored value as found", async () => {
    mockGetItem.mockResolvedValue("{}")

    expect(await readString("persistentState")).toEqual({ status: "found", value: "{}" })
    expect(mockGetItem).toHaveBeenCalledWith("persistentState")
  })

  it("reports a key that is not there as absent", async () => {
    mockGetItem.mockResolvedValue(null)

    expect(await readString("persistentState")).toEqual({ status: "absent" })
  })

  it("reports a read that threw as failed, carrying the error", async () => {
    // The distinction this function exists for: absent is the fresh-install
    // signal, and answering a throwing store that way spends a credential wipe
    // on a device nobody reinstalled.
    const err = new Error("storage unavailable")
    mockGetItem.mockRejectedValue(err)

    expect(await readString("persistentState")).toEqual({ status: "failed", err })
  })

  it("reports a rejection that is not an Error just as faithfully", async () => {
    mockGetItem.mockRejectedValue("not even an error")

    expect(await readString("persistentState")).toEqual({
      status: "failed",
      err: "not even an error",
    })
  })

  it("reports an empty stored value as found, not absent", async () => {
    // A zero-length value is a write that went wrong, not a key that was never
    // written, and its caller has a branch for damage that is not the
    // fresh-install one.
    mockGetItem.mockResolvedValue("")

    expect(await readString("persistentState")).toEqual({ status: "found", value: "" })
  })

  it("leaves loadString collapsing both cases into null", async () => {
    // The contract every other caller reads as "skip this" is deliberately
    // unchanged; readString was added beside it rather than replacing it.
    mockGetItem.mockResolvedValue(null)
    expect(await loadString("anyKey")).toBeNull()

    mockGetItem.mockRejectedValue(new Error("storage unavailable"))
    expect(await loadString("anyKey")).toBeNull()
  })
})
