import { renderHook } from "@testing-library/react-native"

import {
  ImportWalletError,
  SelfCustodialImportError,
  useImportSelfCustodialAccount,
} from "@app/self-custodial/hooks/use-import-self-custodial-account"
import { StorageReadStatus } from "@app/self-custodial/storage/account-index"

const mockRestoreWallet = jest.fn()
const mockReloadSelfCustodialAccounts = jest.fn()
const mockFindAccountByMnemonic = jest.fn()
const mockNetwork = "regtest"
const mockLeewayVbyte = 7

/** The canonical all-zeros BIP-39 test vector: obviously synthetic, and valid, so the real
 *  `validateMnemonic` runs instead of being mocked into always agreeing. */
const VALID_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "imported-account-id",
}))

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  selfCustodialRestoreWallet: (params: unknown) => mockRestoreWallet(params),
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  ...jest.requireActual("@app/self-custodial/storage/account-index"),
  findSelfCustodialAccountByMnemonic: (mnemonic: string) =>
    mockFindAccountByMnemonic(mnemonic),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: mockLeewayVbyte }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

describe("useImportSelfCustodialAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRestoreWallet.mockResolvedValue({ serverMode: null, isServerModeKnown: false })
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
    mockFindAccountByMnemonic.mockResolvedValue({
      status: StorageReadStatus.Ok,
      id: null,
    })
  })

  it("restores the wallet, refreshes the registry, and returns the new account id", async () => {
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    const imported = await result.current.importWallet(VALID_PHRASE)

    expect(imported.accountId).toBe("imported-account-id")
    expect(mockRestoreWallet).toHaveBeenCalledWith({
      accountId: "imported-account-id",
      mnemonic: VALID_PHRASE,
      network: mockNetwork,
      leewaySatPerVbyte: mockLeewayVbyte,
    })
    expect(mockReloadSelfCustodialAccounts).toHaveBeenCalledTimes(1)
  })

  it("normalizes the phrase before looking it up or restoring it", async () => {
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await result.current.importWallet(`  ${VALID_PHRASE.replace(/ /g, "   ")}  `)

    expect(mockFindAccountByMnemonic).toHaveBeenCalledWith(VALID_PHRASE)
    expect(mockRestoreWallet).toHaveBeenCalledWith(
      expect.objectContaining({ mnemonic: VALID_PHRASE }),
    )
  })

  it("rejects a phrase that is not a valid mnemonic, before touching storage", async () => {
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await expect(result.current.importWallet("not a real phrase")).rejects.toThrow(
      SelfCustodialImportError,
    )
    expect(mockFindAccountByMnemonic).not.toHaveBeenCalled()
    expect(mockRestoreWallet).not.toHaveBeenCalled()
  })

  it("reports an invalid phrase with the reason the caller branches on", async () => {
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await expect(result.current.importWallet("not a real phrase")).rejects.toMatchObject({
      reason: ImportWalletError.InvalidMnemonic,
    })
  })

  /** A lookup that cannot read the index must not fall through to restoring: that would
   *  derive a duplicate of an account the index simply failed to report. */
  it("refuses to restore when the account index cannot be read", async () => {
    mockFindAccountByMnemonic.mockResolvedValue({
      status: StorageReadStatus.ReadFailed,
      error: new Error("index unreadable"),
    })
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await expect(result.current.importWallet(VALID_PHRASE)).rejects.toMatchObject({
      reason: ImportWalletError.LookupFailed,
    })
    expect(mockRestoreWallet).not.toHaveBeenCalled()
  })

  /** Re-entering a phrase the device already holds is not a request for a second copy of
   *  the same wallet. */
  it("returns the existing account for a phrase already on the device", async () => {
    mockFindAccountByMnemonic.mockResolvedValue({
      status: StorageReadStatus.Ok,
      id: "already-here",
    })
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    const imported = await result.current.importWallet(VALID_PHRASE)

    expect(imported.accountId).toBe("already-here")
    expect(mockRestoreWallet).not.toHaveBeenCalled()
    expect(mockReloadSelfCustodialAccounts).not.toHaveBeenCalled()
  })

  it("refreshes the registry only after the wallet is restored", async () => {
    const order: string[] = []
    mockRestoreWallet.mockImplementation(async () => {
      order.push("restore")
      return { serverMode: null, isServerModeKnown: false }
    })
    mockReloadSelfCustodialAccounts.mockImplementation(async () => {
      order.push("reload")
    })
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await result.current.importWallet(VALID_PHRASE)

    expect(order).toEqual(["restore", "reload"])
  })

  it("propagates a restore failure without refreshing the registry", async () => {
    mockRestoreWallet.mockRejectedValue(new Error("restore failed"))
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    await expect(result.current.importWallet(VALID_PHRASE)).rejects.toThrow(
      "restore failed",
    )
    expect(mockReloadSelfCustodialAccounts).not.toHaveBeenCalled()
  })
})

describe("useImportSelfCustodialAccount server mode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
    mockFindAccountByMnemonic.mockResolvedValue({
      status: StorageReadStatus.Ok,
      id: null,
    })
  })

  /** The mode the LNURL server holds is readable only while the wallet is connected, so a
   *  caller that never receives it would later default an Anon wallet to Enhanced. */
  it("hands back the server mode the restore read", async () => {
    mockRestoreWallet.mockResolvedValue({ serverMode: "anon", isServerModeKnown: true })
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    const imported = await result.current.importWallet(VALID_PHRASE)

    expect(imported.restored).toEqual({ serverMode: "anon", isServerModeKnown: true })
  })

  /** A wallet already on the device already has its mode stored; re-entering the phrase is
   *  not a fresh answer about how it should behave. */
  it("reports no restore result for a wallet already on the device", async () => {
    mockRestoreWallet.mockResolvedValue({ serverMode: null, isServerModeKnown: false })
    mockFindAccountByMnemonic.mockResolvedValue({
      status: StorageReadStatus.Ok,
      id: "already-here",
    })
    const { result } = renderHook(() => useImportSelfCustodialAccount())

    const imported = await result.current.importWallet(VALID_PHRASE)

    expect(imported.restored).toBeUndefined()
  })
})
