import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import {
  SelfCustodialWalletProvider,
  useSelfCustodialWallet,
} from "@app/self-custodial/providers/wallet"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"

const ACCOUNT_A = "account-a"
const ACCOUNT_B = "account-b"
const sdkA = { id: "sdk-a" }
const sdkB = { id: "sdk-b" }

let mockActiveAccountId = ACCOUNT_A
let mockActiveAccountType = "self-custodial"
const mockReloadSelfCustodialAccounts = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { id: mockActiveAccountId, type: mockActiveAccountType },
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

/** The connection the lifecycle reports, set apart from the active account so a test
 *  can hold the commit where the user has switched and the old SDK is still connected. */
let mockConnection: { sdk: typeof sdkA | null; connectedAccountId: string | null } = {
  sdk: sdkA,
  connectedAccountId: ACCOUNT_A,
}
let mockTransactions: NormalizedTransaction[] = []
const mockLifecycle = {
  wallets: [],
  status: "ready",
  sdkStableBalanceActive: false,
  lastPaymentEventKey: null,
  lastReceivedPaymentId: null,
  hasMoreTransactions: false,
  loadingMore: false,
  loadMore: jest.fn(),
  refreshWallets: jest.fn(),
  refreshStableBalanceActive: jest.fn(),
}
jest.mock("@app/self-custodial/hooks/use-sdk-lifecycle", () => ({
  useSdkLifecycle: () => ({
    ...mockLifecycle,
    allTransactions: mockTransactions,
    ...mockConnection,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ stableBalanceEnabled: false }),
}))

const mockGetLightningAddress = jest.fn()
jest.mock("@app/self-custodial/bridge", () => ({
  getLightningAddress: (...args: unknown[]) => mockGetLightningAddress(...args),
}))

const mockGetSelfCustodialLightningAddress = jest.fn()
const mockSetSelfCustodialLightningAddress = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/storage/account-index", () => ({
  getSelfCustodialLightningAddress: (id: string) =>
    mockGetSelfCustodialLightningAddress(id),
  setSelfCustodialLightningAddress: (...args: unknown[]) =>
    mockSetSelfCustodialLightningAddress(...args),
}))

jest.mock("@app/utils/error-reporting", () => ({ recordAppError: jest.fn() }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelfCustodialWalletProvider>{children}</SelfCustodialWalletProvider>
)

const STORED_ADDRESSES: Record<string, string> = {
  [ACCOUNT_A]: "alice@blink.sv",
  [ACCOUNT_B]: "bob@blink.sv",
}

describe("SelfCustodialWalletProvider — the Lightning Address across an account switch", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountId = ACCOUNT_A
    mockActiveAccountType = "self-custodial"
    mockConnection = { sdk: sdkA, connectedAccountId: ACCOUNT_A }
    mockGetSelfCustodialLightningAddress.mockImplementation(
      async (id: string) => STORED_ADDRESSES[id] ?? null,
    )
  })

  it("keeps the account switched to when the previous account's lookup lands late", async () => {
    let resolveLookupA: (info: { lightningAddress: string }) => void = () => {}
    mockGetLightningAddress.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookupA = resolve
        }),
    )

    const { result, rerender } = renderHook(() => useSelfCustodialWallet(), { wrapper })
    await waitFor(() => expect(mockGetLightningAddress).toHaveBeenCalledWith(sdkA))

    mockActiveAccountId = ACCOUNT_B
    rerender(undefined)
    await waitFor(() => expect(result.current.lightningAddress).toBe("bob@blink.sv"))

    await act(async () => {
      resolveLookupA({ lightningAddress: "alice@blink.sv" })
    })

    expect(result.current.lightningAddress).toBe("bob@blink.sv")
    expect(mockSetSelfCustodialLightningAddress).not.toHaveBeenCalled()
  })

  it("keeps the account switched to when a manual refresh started on the previous one lands late", async () => {
    mockGetLightningAddress.mockResolvedValueOnce({ lightningAddress: "alice@blink.sv" })
    let resolveRefreshA: (info: { lightningAddress: string }) => void = () => {}
    mockGetLightningAddress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefreshA = resolve
        }),
    )

    const { result, rerender } = renderHook(() => useSelfCustodialWallet(), { wrapper })
    await waitFor(() => expect(result.current.lightningAddress).toBe("alice@blink.sv"))
    let refreshA: Promise<void> = Promise.resolve()
    act(() => {
      refreshA = result.current.updateCurrentSelfCustodialAccount()
    })
    await waitFor(() => expect(mockGetLightningAddress).toHaveBeenCalledTimes(2))

    mockActiveAccountId = ACCOUNT_B
    rerender(undefined)
    await waitFor(() => expect(result.current.lightningAddress).toBe("bob@blink.sv"))

    await act(async () => {
      resolveRefreshA({ lightningAddress: "alice@blink.sv" })
      await refreshA
    })

    expect(result.current.lightningAddress).toBe("bob@blink.sv")
    expect(mockSetSelfCustodialLightningAddress).toHaveBeenLastCalledWith(
      ACCOUNT_A,
      "alice@blink.sv",
    )
  })

  it("asks nothing of the previous account's SDK once the account has switched", async () => {
    mockActiveAccountId = ACCOUNT_B

    renderHook(() => useSelfCustodialWallet(), { wrapper })
    await waitFor(() =>
      expect(mockGetSelfCustodialLightningAddress).toHaveBeenCalledWith(ACCOUNT_B),
    )

    expect(mockGetLightningAddress).not.toHaveBeenCalled()
  })

  it("asks the new account's SDK once its connection catches up", async () => {
    mockGetLightningAddress.mockResolvedValue({ lightningAddress: "bob@blink.sv" })
    mockActiveAccountId = ACCOUNT_B

    const { result, rerender } = renderHook(() => useSelfCustodialWallet(), { wrapper })
    mockConnection = { sdk: sdkB, connectedAccountId: ACCOUNT_B }
    rerender(undefined)

    await waitFor(() =>
      expect(mockSetSelfCustodialLightningAddress).toHaveBeenCalledWith(
        ACCOUNT_B,
        "bob@blink.sv",
      ),
    )
    expect(mockGetLightningAddress).toHaveBeenCalledWith(sdkB)
    expect(result.current.lightningAddress).toBe("bob@blink.sv")
  })
})

const receiveOf = (id: string): NormalizedTransaction => ({
  id,
  amount: { amount: 10, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  direction: TransactionDirection.Receive,
  status: TransactionStatus.Completed,
  timestamp: 1700000000,
  paymentType: PaymentType.Lightning,
})

describe("SelfCustodialWalletProvider — the transactions across an account switch", () => {
  const paymentOfA = receiveOf("payment-of-a")
  const paymentOfB = receiveOf("payment-of-b")

  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountId = ACCOUNT_A
    mockActiveAccountType = "self-custodial"
    mockConnection = { sdk: sdkA, connectedAccountId: ACCOUNT_A }
    mockTransactions = [paymentOfA]
  })

  it("publishes the connection's transactions while it is the active account's", async () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => expect(result.current.allTransactions).toEqual([paymentOfA]))
  })

  it("publishes none of the previous account's transactions once the account has switched", async () => {
    mockActiveAccountId = ACCOUNT_B

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => expect(result.current.allTransactions).toEqual([]))
  })

  it("publishes the new account's transactions once its connection catches up", async () => {
    mockActiveAccountId = ACCOUNT_B

    const { result, rerender } = renderHook(() => useSelfCustodialWallet(), { wrapper })
    expect(result.current.allTransactions).toEqual([])

    mockConnection = { sdk: sdkB, connectedAccountId: ACCOUNT_B }
    mockTransactions = [paymentOfB]
    rerender(undefined)

    await waitFor(() => expect(result.current.allTransactions).toEqual([paymentOfB]))
  })

  it("publishes nothing while the new account's connection is on its way", async () => {
    mockActiveAccountId = ACCOUNT_B
    mockConnection = { sdk: null, connectedAccountId: null }

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => expect(result.current.allTransactions).toEqual([]))
  })

  it("publishes nothing while a custodial account is active", async () => {
    mockActiveAccountType = "custodial"
    mockConnection = { sdk: null, connectedAccountId: null }

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    await waitFor(() => expect(result.current.allTransactions).toEqual([]))
  })
})
