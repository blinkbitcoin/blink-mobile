import { getAllKeys, loadString, readString } from "@app/utils/storage"

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
