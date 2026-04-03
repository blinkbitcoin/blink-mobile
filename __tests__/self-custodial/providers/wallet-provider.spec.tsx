import React from "react"
import { Text } from "react-native"
import { render, renderHook } from "@testing-library/react-native"

import { AccountType, ActiveWalletStatus } from "@app/types/wallet.types"

import {
  SelfCustodialWalletProvider,
  useSelfCustodialWallet,
} from "@app/self-custodial/providers/wallet-provider"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  // eslint-disable-next-line camelcase
  SdkEvent_Tags: {
    Synced: "Synced",
    PaymentSucceeded: "PaymentSucceeded",
    PaymentPending: "PaymentPending",
    ClaimedDeposits: "ClaimedDeposits",
    UnclaimedDeposits: "UnclaimedDeposits",
  },
  initLogging: jest.fn(),
}))

const mockHasMnemonic = jest.fn()
const mockGetMnemonic = jest.fn()
const mockNonCustodialEnabled = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => {
  const mock = {
    hasMnemonic: () => mockHasMnemonic(),
    getMnemonic: () => mockGetMnemonic(),
  }
  return { __esModule: true, default: mock }
})

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled(),
  }),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: jest.fn().mockRejectedValue(new Error("SDK not available in test")),
  disconnectSdk: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkToken: { Label: "USDB", Ticker: "USDB" },
  SparkConfig: {
    storageDir: "/test",
    maxSlippageBps: 50,
    tokenIdentifier: "test-id",
    apiKey: "test-key",
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelfCustodialWalletProvider>{children}</SelfCustodialWalletProvider>
)

describe("SelfCustodialWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNonCustodialEnabled.mockReturnValue(false)
    mockHasMnemonic.mockResolvedValue(false)
    mockGetMnemonic.mockResolvedValue("")
  })

  it("renders children", () => {
    const { getByText } = render(
      <SelfCustodialWalletProvider>
        <Text>child</Text>
      </SelfCustodialWalletProvider>,
    )

    expect(getByText("child")).toBeTruthy()
  })

  it("returns unavailable when flag is disabled", async () => {
    mockNonCustodialEnabled.mockReturnValue(false)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("returns unavailable when no mnemonic exists", async () => {
    mockNonCustodialEnabled.mockReturnValue(true)
    mockHasMnemonic.mockResolvedValue(false)

    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
  })

  it("sets accountType to self-custodial", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
  })

  it("provides retry function", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.retry).toBeDefined()
    expect(typeof result.current.retry).toBe("function")
  })

  it("default state has empty wallets", () => {
    const { result } = renderHook(() => useSelfCustodialWallet(), { wrapper })

    expect(result.current.wallets).toEqual([])
  })
})
