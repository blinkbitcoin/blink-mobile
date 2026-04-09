import React from "react"
import { Text } from "react-native"
import { render, renderHook, waitFor } from "@testing-library/react-native"

import { AccountType, ActiveWalletStatus } from "@app/types/wallet.types"

import {
  SelfCustodialWalletProvider,
  useSelfCustodialWallet,
} from "@app/self-custodial/providers/wallet-provider"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  // eslint-disable-next-line camelcase
  SdkEvent_Tags: {
    Synced: "Synced",
    PaymentSucceeded: "PaymentSucceeded",
    PaymentPending: "PaymentPending",
    ClaimedDeposits: "ClaimedDeposits",
    UnclaimedDeposits: "UnclaimedDeposits",
    PaymentFailed: "PaymentFailed",
    Optimization: "Optimization",
  },
  initLogging: jest.fn(),
}))

const mockGetMnemonic = jest.fn()
const mockGetMnemonicNetwork = jest.fn()
const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getMnemonic: () => mockGetMnemonic(),
    getMnemonicNetwork: () => mockGetMnemonicNetwork(),
  },
}))

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (...args: unknown[]) => mockInitSdk(...args),
  disconnectSdk: (...args: unknown[]) => mockDisconnectSdk(...args),
}))

jest.mock("@app/self-custodial/logging", () => ({
  logSdkEvent: jest.fn(),
  SdkLogLevel: { Error: "error" },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { network: 1 },
}))

jest.mock("@app/self-custodial/providers/wallet-snapshot", () => ({
  getSelfCustodialWalletSnapshot: jest.fn().mockResolvedValue([]),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelfCustodialWalletProvider>{children}</SelfCustodialWalletProvider>
)

describe("SelfCustodialWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue(null)
    mockGetMnemonicNetwork.mockResolvedValue("regtest")
    mockInitSdk.mockRejectedValue(new Error("SDK not available in test"))
    mockDisconnectSdk.mockResolvedValue(undefined)
  })

  it("renders children", () => {
    const { getByText } = render(
      <SelfCustodialWalletProvider>
        <Text>child</Text>
      </SelfCustodialWalletProvider>,
    )

    expect(getByText("child")).toBeTruthy()
  })

  it("returns unavailable when no mnemonic exists", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    })
  })

  it("sets accountType to self-custodial", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
  })

  it("provides retry function", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(typeof result.current.retry).toBe("function")
  })

  it("default state has empty wallets", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.wallets).toEqual([])
  })

  it("sets error status on network mismatch", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockGetMnemonicNetwork.mockResolvedValue("mainnet")

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })

    expect(mockInitSdk).not.toHaveBeenCalled()
  })

  it("allows null stored network (legacy wallets)", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockGetMnemonicNetwork.mockResolvedValue(null)
    mockInitSdk.mockRejectedValue(new Error("SDK not available"))

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })
  })

  it("sets error status when SDK init fails", async () => {
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockRejectedValue(new Error("init failed"))

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Error)
    })
  })

  it("does not call initSdk when mnemonic is null", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).not.toHaveBeenCalled()
    })
  })

  it("sets Loading then Ready on successful init", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot
    mockSnapshot.mockResolvedValue([])

    const mockSdk = {
      addEventListener: jest.fn().mockResolvedValue("id"),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })
  })

  it("initializes SDK regardless of feature flag state (rollback-safe)", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot
    mockSnapshot.mockResolvedValue([])

    const mockSdk = {
      addEventListener: jest.fn().mockResolvedValue("id"),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    expect(mockInitSdk).toHaveBeenCalledWith("word1 word2 word3")
  })

  it("handles refresh error gracefully", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot
    mockSnapshot.mockRejectedValueOnce(new Error("refresh failed"))
    mockSnapshot.mockResolvedValue([])

    const mockSdk = {
      addEventListener: jest.fn().mockResolvedValue("id"),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockSnapshot).toHaveBeenCalled()
    })

    expect(result.current.wallets).toEqual([])
  })

  it("triggers refresh on SDK events", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot
    mockSnapshot.mockResolvedValue([])

    let capturedListener: (event: { tag: string }) => Promise<void>
    const mockSdk = {
      addEventListener: jest.fn().mockImplementation(({ onEvent }) => {
        capturedListener = onEvent
        return Promise.resolve("id")
      }),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    mockSnapshot.mockClear()
    await capturedListener!({ tag: "Synced" })

    expect(mockSnapshot).toHaveBeenCalledTimes(1)
  })

  it("does not refresh on non-refresh events", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot
    mockSnapshot.mockResolvedValue([])

    let capturedListener: (event: { tag: string }) => Promise<void>
    const mockSdk = {
      addEventListener: jest.fn().mockImplementation(({ onEvent }) => {
        capturedListener = onEvent
        return Promise.resolve("id")
      }),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    })

    mockSnapshot.mockClear()
    await capturedListener!({ tag: "PaymentFailed" })

    expect(mockSnapshot).not.toHaveBeenCalled()
  })

  it("coalesces rapid refresh calls", async () => {
    const mockSnapshot = jest.requireMock(
      "@app/self-custodial/providers/wallet-snapshot",
    ).getSelfCustodialWalletSnapshot

    let resolveFirst: () => void
    mockSnapshot.mockImplementationOnce(
      () =>
        new Promise<never[]>((resolve) => {
          resolveFirst = () => resolve([])
        }),
    )
    mockSnapshot.mockResolvedValue([])

    let capturedListener: (event: { tag: string }) => Promise<void>
    const mockSdk = {
      addEventListener: jest.fn().mockImplementation(({ onEvent }) => {
        capturedListener = onEvent
        return Promise.resolve("id")
      }),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockSdk.addEventListener).toHaveBeenCalled()
    })

    // Fire event while first refresh is in-flight
    capturedListener!({ tag: "Synced" })

    // Resolve first refresh
    resolveFirst!()

    await waitFor(() => {
      // Initial refresh + event-triggered coalesced refresh
      expect(mockSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  it("disconnects SDK on unmount", async () => {
    const mockSdk = {
      addEventListener: jest.fn().mockResolvedValue("listener-id"),
      disconnect: jest.fn(),
    }
    mockGetMnemonic.mockResolvedValue("word1 word2 word3")
    mockInitSdk.mockResolvedValue(mockSdk)

    const { unmount } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => {
      expect(mockInitSdk).toHaveBeenCalled()
    })

    unmount()

    expect(mockDisconnectSdk).toHaveBeenCalledWith(mockSdk)
  })
})
