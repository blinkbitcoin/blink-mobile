import { renderHook, waitFor } from "@testing-library/react-native"

import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"

const mockGetWalletInfo = jest.fn()
const mockGetLightningAddress = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  getWalletInfo: (...args: unknown[]) => mockGetWalletInfo(...args),
  getLightningAddress: (...args: unknown[]) => mockGetLightningAddress(...args),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockSdk = { id: "sdk" }

describe("useSelfCustodialAccountInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("flips to loading=false with an unavailable-error when sdk is null (Important #3: no infinite spinner offline)", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { result } = renderHook(() => useSelfCustodialAccountInfo())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.identityPubkey).toBe("")
    expect(result.current.lightningAddress).toBeNull()
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("Self-custodial wallet unavailable")
    expect(mockGetWalletInfo).not.toHaveBeenCalled()
  })

  it("flips back to loading=true and clears the unavailable-error when sdk transitions from null to a value", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: "pubkey-after-recovery" })
    mockGetLightningAddress.mockResolvedValue({
      lightningAddress: "user@spark.tips",
    })

    const { result, rerender } = renderHook(() => useSelfCustodialAccountInfo())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBeNull()

    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    rerender(undefined)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.identityPubkey).toBe("pubkey-after-recovery")
    expect(result.current.lightningAddress).toBe("user@spark.tips")
    expect(result.current.error).toBeNull()
  })

  it("populates identityPubkey and lightningAddress on success", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: "pubkey-1" })
    mockGetLightningAddress.mockResolvedValue({ lightningAddress: "user@spark.tips" })

    const { result } = renderHook(() => useSelfCustodialAccountInfo())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.identityPubkey).toBe("pubkey-1")
    expect(result.current.lightningAddress).toBe("user@spark.tips")
    expect(result.current.error).toBeNull()
  })

  it("treats a missing lightning address as null without erroring", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: "pubkey-2" })
    mockGetLightningAddress.mockRejectedValue(new Error("not registered"))

    const { result } = renderHook(() => useSelfCustodialAccountInfo())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.identityPubkey).toBe("pubkey-2")
    expect(result.current.lightningAddress).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("captures the error when wallet info fetch fails", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockGetWalletInfo.mockRejectedValue(new Error("network down"))
    mockGetLightningAddress.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSelfCustodialAccountInfo())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.identityPubkey).toBe("")
    expect(result.current.lightningAddress).toBeNull()
    expect(result.current.error?.message).toBe("network down")
  })
})
