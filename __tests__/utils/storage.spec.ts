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

describe("loadJsonOrThrow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("parses what is stored under the key", async () => {
    mockGetItem.mockResolvedValue('{"count":2}')

    expect(await loadJsonOrThrow("key")).toEqual({ count: 2 })
    expect(mockGetItem).toHaveBeenCalledWith("key")
  })

  it("reads an absent key as null", async () => {
    mockGetItem.mockResolvedValue(null)

    expect(await loadJsonOrThrow("key")).toBeNull()
  })

  it("rejects on a failed read, so the caller can tell it from an absent key", async () => {
    mockGetItem.mockRejectedValue(new Error("storage unavailable"))

    await expect(loadJsonOrThrow("key")).rejects.toThrow("storage unavailable")
  })

  it("rejects on content it cannot parse", async () => {
    mockGetItem.mockResolvedValue("{not json")

    await expect(loadJsonOrThrow("key")).rejects.toThrow()
  })
})

describe("loadJson", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reads a failed read as null", async () => {
    mockGetItem.mockRejectedValue(new Error("storage unavailable"))

    expect(await loadJson("key")).toBeNull()
  })

  it("reads content it cannot parse as null", async () => {
    mockGetItem.mockResolvedValue("{not json")

    expect(await loadJson("key")).toBeNull()
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
