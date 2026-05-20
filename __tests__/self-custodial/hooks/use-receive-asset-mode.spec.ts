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

    it("does NOT reset Dollar to Bitcoin when stable balance toggles OFF (Important #5)", () => {
      // Asymmetry is intentional: ON re-aligns to Dollar to enforce the new
      // sweep policy, but OFF preserves the user's last explicit choice so a
      // future "fix" that resets to BTC would silently regress receive intent.
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })
      const { result, rerender } = renderHook(() => useReceiveAssetMode())

      expect(result.current.assetMode).toBe("dollar")

      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      rerender({})

      expect(result.current.assetMode).toBe("dollar")
      expect(result.current.isToggleDisabled).toBe(false)
    })
  })

  describe("loading flag (Critical #7 boot window)", () => {
    it("is true while isStableBalanceActive is undefined and assetMode placeholder is Bitcoin", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.loading).toBe(true)
      expect(result.current.assetMode).toBe("bitcoin")
      expect(result.current.isToggleDisabled).toBe(false)
    })

    it("flips to false and re-aligns to Dollar when settings resolve to active", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result, rerender } = renderHook(() => useReceiveAssetMode())

      expect(result.current.loading).toBe(true)
      expect(result.current.assetMode).toBe("bitcoin")

      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: true })
      rerender({})

      expect(result.current.loading).toBe(false)
      expect(result.current.assetMode).toBe("dollar")
      expect(result.current.isToggleDisabled).toBe(true)
    })

    it("flips to false and keeps Bitcoin when settings resolve to inactive", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result, rerender } = renderHook(() => useReceiveAssetMode())

      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: false })
      rerender({})

      expect(result.current.loading).toBe(false)
      expect(result.current.assetMode).toBe("bitcoin")
      expect(result.current.isToggleDisabled).toBe(false)
    })

    it("exposes both modes on Lightning while loading (no premature restriction)", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.availableModesForRail("lightning")).toEqual([
        "bitcoin",
        "dollar",
      ])
    })

    it("restricts the Onchain rail to Bitcoin even while loading", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result } = renderHook(() => useReceiveAssetMode())
      expect(result.current.availableModesForRail("onchain")).toEqual(["bitcoin"])
    })

    it("setAssetMode applies during loading so the user can pre-select", () => {
      mockSelfCustodialWallet.mockReturnValue({ isStableBalanceActive: undefined })
      const { result } = renderHook(() => useReceiveAssetMode())

      expect(result.current.assetMode).toBe("bitcoin")
      act(() => {
        result.current.setAssetMode("dollar")
      })
      expect(result.current.assetMode).toBe("dollar")
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
