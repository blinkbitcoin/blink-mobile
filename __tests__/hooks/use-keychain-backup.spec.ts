import { renderHook, act } from "@testing-library/react-native"

import { useKeychainBackup } from "@app/hooks/use-keychain-backup"

const mockSetGenericPassword = jest.fn()

jest.mock("react-native-keychain", () => ({
  setGenericPassword: (...args: readonly unknown[]) => mockSetGenericPassword(...args),
}))

describe("useKeychainBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("save", () => {
    it("saves seed to keychain and returns true", async () => {
      mockSetGenericPassword.mockResolvedValue({ service: "test-service" })

      const { result } = renderHook(() => useKeychainBackup("test-service"))

      let success = false
      await act(async () => {
        success = await result.current.save("youth indicate void")
      })

      expect(success).toBe(true)
      expect(mockSetGenericPassword).toHaveBeenCalledWith(
        "test-service",
        "youth indicate void",
        expect.objectContaining({ service: "test-service" }),
      )
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeUndefined()
    })

    it("returns false when keychain save fails", async () => {
      mockSetGenericPassword.mockResolvedValue(false)

      const { result } = renderHook(() => useKeychainBackup("test-service"))

      let success = true
      await act(async () => {
        success = await result.current.save("youth indicate void")
      })

      expect(success).toBe(false)
    })

    it("sets error on exception", async () => {
      mockSetGenericPassword.mockRejectedValue(new Error("Keychain error"))

      const { result } = renderHook(() => useKeychainBackup("test-service"))

      let success = true
      await act(async () => {
        success = await result.current.save("youth indicate void")
      })

      expect(success).toBe(false)
      expect(result.current.error).toBe("Keychain error")
      expect(result.current.loading).toBe(false)
    })

    it("sets fallback error on non-Error exception", async () => {
      mockSetGenericPassword.mockRejectedValue("string error")

      const { result } = renderHook(() => useKeychainBackup("test-service"))

      let success = true
      await act(async () => {
        success = await result.current.save("youth indicate void")
      })

      expect(success).toBe(false)
      expect(result.current.error).toBe("Unknown error")
    })
  })
})
