import { renderHook, waitFor } from "@testing-library/react-native"

import { useWalletMnemonic, useWalletMnemonicWords } from "@app/hooks/use-wallet-mnemonic"

const mockGetMnemonic = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonic: () => mockGetMnemonic(),
  },
}))

describe("useWalletMnemonic", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty string initially", () => {
    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useWalletMnemonic())

    expect(result.current).toBe("")
  })

  it("loads mnemonic from keychain", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(result.current).toBe("word1 word2 word3")
    })
  })

  it("does not set state when keychain returns null", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useWalletMnemonic())

    await waitFor(() => {
      expect(mockGetMnemonic).toHaveBeenCalled()
    })

    expect(result.current).toBe("")
  })
})

describe("useWalletMnemonicWords", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty array when no mnemonic", () => {
    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useWalletMnemonicWords())

    expect(result.current).toEqual([])
  })

  it("splits mnemonic into words", async () => {
    mockGetMnemonic.mockResolvedValue("alpha beta gamma")

    const { result } = renderHook(() => useWalletMnemonicWords())

    await waitFor(() => {
      expect(result.current).toEqual(["alpha", "beta", "gamma"])
    })
  })
})
