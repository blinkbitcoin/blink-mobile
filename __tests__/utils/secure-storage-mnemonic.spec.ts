import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockGet = jest.fn()
const mockSet = jest.fn()
const mockRemove = jest.fn()

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (...args: string[]) => mockGet(...args),
    set: (...args: string[]) => mockSet(...args),
    remove: (...args: string[]) => mockRemove(...args),
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "ALWAYS_THIS_DEVICE_ONLY",
  },
}))

describe("KeyStoreWrapper mnemonic methods", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("hasMnemonic", () => {
    it("returns true when mnemonic exists", async () => {
      mockGet.mockResolvedValue("word1 word2 word3")

      const result = await KeyStoreWrapper.hasMnemonic()

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("mnemonic")
    })

    it("returns false when mnemonic does not exist", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.hasMnemonic()

      expect(result).toBe(false)
    })
  })

  describe("getMnemonic", () => {
    it("returns mnemonic string when exists", async () => {
      mockGet.mockResolvedValue(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
      )

      const result = await KeyStoreWrapper.getMnemonic()

      expect(result).toBe(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
      )
    })

    it("returns empty string when not found", async () => {
      mockGet.mockRejectedValue(new Error("not found"))

      const result = await KeyStoreWrapper.getMnemonic()

      expect(result).toBe("")
    })
  })

  describe("setMnemonic", () => {
    it("stores mnemonic and returns true on success", async () => {
      mockSet.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.setMnemonic("test mnemonic")

      expect(result).toBe(true)
      expect(mockSet).toHaveBeenCalledWith("mnemonic", "test mnemonic", {
        accessible: "ALWAYS_THIS_DEVICE_ONLY",
      })
    })

    it("returns false on failure", async () => {
      mockSet.mockRejectedValue(new Error("storage error"))

      const result = await KeyStoreWrapper.setMnemonic("test mnemonic")

      expect(result).toBe(false)
    })
  })

  describe("deleteMnemonic", () => {
    it("removes mnemonic and returns true on success", async () => {
      mockRemove.mockResolvedValue(undefined)

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith("mnemonic")
    })

    it("returns false on failure", async () => {
      mockRemove.mockRejectedValue(new Error("remove error"))

      const result = await KeyStoreWrapper.deleteMnemonic()

      expect(result).toBe(false)
    })
  })
})
