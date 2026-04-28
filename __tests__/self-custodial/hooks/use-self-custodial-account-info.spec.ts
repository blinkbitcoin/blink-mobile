import { renderHook, waitFor } from "@testing-library/react-native"

import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"

const mockGetWalletInfo = jest.fn()
const mockGetLightningAddress = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  getWalletInfo: (...args: unknown[]) => mockGetWalletInfo(...args),
  getLightningAddress: (...args: unknown[]) => mockGetLightningAddress(...args),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockSdk = { id: "sdk" }

describe("useSelfCustodialAccountInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays in loading=true when sdk is null", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { result } = renderHook(() => useSelfCustodialAccountInfo())

    expect(result.current).toEqual({
      identityPubkey: "",
      lightningAddress: null,
      loading: true,
      error: null,
    })
    expect(mockGetWalletInfo).not.toHaveBeenCalled()
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
