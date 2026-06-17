import { renderHook } from "@testing-library/react-native"

import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"

const mockCreateWallet = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()

jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "provisioned-account-id",
}))

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialCreateWallet: (accountId: string) => mockCreateWallet(accountId),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

describe("useProvisionSelfCustodialAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateWallet.mockResolvedValue(undefined)
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
  })

  it("creates the wallet, refreshes the registry, and returns the new account id", async () => {
    const { result } = renderHook(() => useProvisionSelfCustodialAccount())

    const accountId = await result.current.provision()

    expect(accountId).toBe("provisioned-account-id")
    expect(mockCreateWallet).toHaveBeenCalledWith("provisioned-account-id")
    expect(mockReloadSelfCustodialAccounts).toHaveBeenCalledTimes(1)
  })

  it("refreshes the registry only after the wallet is created", async () => {
    const order: string[] = []
    mockCreateWallet.mockImplementation(async () => {
      order.push("create")
    })
    mockReloadSelfCustodialAccounts.mockImplementation(async () => {
      order.push("reload")
    })

    const { result } = renderHook(() => useProvisionSelfCustodialAccount())
    await result.current.provision()

    expect(order).toEqual(["create", "reload"])
  })

  it("propagates a creation failure without refreshing the registry", async () => {
    mockCreateWallet.mockRejectedValue(new Error("create failed"))

    const { result } = renderHook(() => useProvisionSelfCustodialAccount())

    await expect(result.current.provision()).rejects.toThrow("create failed")
    expect(mockReloadSelfCustodialAccounts).not.toHaveBeenCalled()
  })
})
