import { act, renderHook } from "@testing-library/react-native"

import { useReceiveAssetMode } from "@app/self-custodial/hooks/use-receive-asset-mode"

const mockSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

describe("useReceiveAssetMode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("initial state", () => {
    it("defaults to Bitcoin when stable balance is inactive", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.assetMode).toBe("bitcoin")
      expect(result.current.isToggleDisabled).toBe(false)
    })

    it("starts on Dollar and locks the toggle when stable balance is active", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.assetMode).toBe("dollar")
      expect(result.current.isToggleDisabled).toBe(true)
    })
  })

  describe("setAssetMode", () => {
    it("updates the mode when the toggle is free", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      const { result } = renderHook(() => useReceiveAssetMode())

      act(() => {
        result.current.setAssetMode("dollar")
      })

      expect(result.current.assetMode).toBe("dollar")
    })
  })

  describe("re-alignment when stable balance toggles ON mid-session", () => {
    it("snaps Bitcoin back to Dollar", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      const { result, rerender } = renderHook(() => useReceiveAssetMode())

      expect(result.current.assetMode).toBe("bitcoin")

      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })
      rerender({})

      expect(result.current.assetMode).toBe("dollar")
      expect(result.current.isToggleDisabled).toBe(true)
    })
  })

  describe("availableModesForRail", () => {
    it("restricts the Onchain rail to Bitcoin regardless of asset mode", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.availableModesForRail("onchain")).toEqual(["bitcoin"])
    })

    it("restricts the Lightning rail to Dollar when stable balance is active", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.availableModesForRail("lightning")).toEqual(["dollar"])
    })

    it("exposes both modes on Lightning when stable balance is inactive", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.availableModesForRail("lightning")).toEqual([
        "bitcoin",
        "dollar",
      ])
    })
  })
})
