import { getAllKeys } from "@app/utils/storage"

const mockGetAllKeys = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
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
