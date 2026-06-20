import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { act, renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../../helpers/flush-effects"

jest.mock("react-native-config", () => ({}))
jest.mock("react-native-fs", () => ({ DocumentDirectoryPath: "/test/documents" }))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockGetMnemonicNetwork = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonicNetworkForAccount: (...args: unknown[]) => mockGetMnemonicNetwork(...args),
  },
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

let mockNetwork = mockSparkNetwork.Regtest
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

const mockToastMessage = jest.fn(
  (arg: { network: string }) => `network-mismatch:${arg.network}`,
)
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { SelfCustodialNetworkMismatch: { toast: mockToastMessage } },
  }),
}))

import { useSelfCustodialNetworkMismatchToast } from "@app/self-custodial/hooks/use-network-mismatch-toast"

const SC_ACCOUNT = { id: "acct-1", type: AccountType.SelfCustodial }

describe("useSelfCustodialNetworkMismatchToast", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNetwork = mockSparkNetwork.Regtest
    mockUseAccountRegistry.mockReturnValue({ activeAccount: SC_ACCOUNT })
    mockGetMnemonicNetwork.mockResolvedValue("mainnet")
  })

  it("shows the network-mismatch toast naming the wallet's network when it differs from the current network", async () => {
    renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    expect(mockGetMnemonicNetwork).toHaveBeenCalledWith("acct-1")
    expect(mockToastMessage).toHaveBeenCalledWith({ network: "mainnet" })
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "network-mismatch:mainnet" }),
    )
  })

  it("does not toast when the stored network matches the current network", async () => {
    mockGetMnemonicNetwork.mockResolvedValue("regtest")

    renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("does not toast when the account has no stored network label", async () => {
    mockGetMnemonicNetwork.mockResolvedValue(null)

    renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("does not toast (nor read storage) when the active account is custodial", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "cust-1", type: AccountType.Custodial },
    })

    renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    expect(mockGetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("does not toast when there is no active account", async () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })

    renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    expect(mockGetMnemonicNetwork).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("toasts only once across re-renders for the same mismatch", async () => {
    const { rerender } = renderHook(() => useSelfCustodialNetworkMismatchToast())
    await flushEffects()

    rerender({})
    await flushEffects()

    expect(mockToastShow).toHaveBeenCalledTimes(1)
  })

  it("does not toast when the hook unmounts before the network lookup resolves", async () => {
    let resolveLookup: (value: string) => void = () => {}
    mockGetMnemonicNetwork.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveLookup = resolve
      }),
    )

    const { unmount } = renderHook(() => useSelfCustodialNetworkMismatchToast())
    unmount()

    await act(async () => {
      resolveLookup("mainnet")
      await flushEffects()
    })

    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
