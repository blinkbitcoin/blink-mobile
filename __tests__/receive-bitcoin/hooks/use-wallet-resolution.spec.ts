import { renderHook } from "@testing-library/react-hooks"

import { useWalletResolution } from "@app/screens/receive-bitcoin-screen/hooks/use-wallet-resolution"
import { WalletCurrency, Network } from "@app/graphql/generated"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockQueryData = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  Network: {
    Mainnet: "mainnet",
    Testnet: "testnet",
    Regtest: "regtest",
    Signet: "signet",
  },
  usePaymentRequestQuery: (...args: ReadonlyArray<Record<string, unknown>>) =>
    mockQueryData(...args),
  useRealtimePriceQuery: jest.fn(),
}))

const mockGetDefaultWallet = jest.fn()
const mockGetBtcWallet = jest.fn()
const mockGetUsdWallet = jest.fn()
jest.mock("@app/graphql/wallets-utils", () => ({
  getDefaultWallet: (...args: ReadonlyArray<unknown[]>) => mockGetDefaultWallet(...args),
  getBtcWallet: (...args: ReadonlyArray<unknown[]>) => mockGetBtcWallet(...args),
  getUsdWallet: (...args: ReadonlyArray<unknown[]>) => mockGetUsdWallet(...args),
}))

const mockConvertMoneyAmount = jest.fn()
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        posUrl: "https://pay.blink.sv",
        lnAddressHostname: "blink.sv",
      },
    },
  }),
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount,
  }),
}))

const btcWallet = { id: "btc-id", balance: 50000, walletCurrency: WalletCurrency.Btc }
const usdWallet = { id: "usd-id", balance: 100, walletCurrency: WalletCurrency.Usd }

describe("useWalletResolution", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockGetDefaultWallet.mockReturnValue(btcWallet)
    mockGetBtcWallet.mockReturnValue(btcWallet)
    mockGetUsdWallet.mockReturnValue(usdWallet)
  })

  it("returns null when not authed and no data", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockQueryData.mockReturnValue({ data: undefined })
    mockGetDefaultWallet.mockReturnValue(undefined)
    mockGetBtcWallet.mockReturnValue(undefined)

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current).toBeNull()
  })

  it("returns null when defaultWallet is missing", () => {
    mockQueryData.mockReturnValue({
      data: {
        me: {
          username: "testuser",
          defaultAccount: { wallets: [], defaultWalletId: "x" },
        },
        globals: { network: Network.Mainnet, feesInformation: null },
      },
    })
    mockGetDefaultWallet.mockReturnValue(undefined)
    mockGetBtcWallet.mockReturnValue(undefined)

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current).toBeNull()
  })

  it("returns null when bitcoinWallet is missing", () => {
    mockQueryData.mockReturnValue({
      data: {
        me: {
          username: "testuser",
          defaultAccount: { wallets: [usdWallet], defaultWalletId: "usd-id" },
        },
        globals: { network: Network.Mainnet, feesInformation: null },
      },
    })
    mockGetDefaultWallet.mockReturnValue(usdWallet)
    mockGetBtcWallet.mockReturnValue(undefined)

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current).toBeNull()
  })

  it("returns resolved wallets when data is available", () => {
    mockQueryData.mockReturnValue({
      data: {
        me: {
          username: "testuser",
          defaultAccount: {
            wallets: [btcWallet, usdWallet],
            defaultWalletId: "btc-id",
          },
        },
        globals: {
          network: Network.Mainnet,
          feesInformation: {
            deposit: { minBankFee: "0", minBankFeeThreshold: "0", ratio: "0" },
          },
        },
      },
    })

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current).not.toBeNull()
    expect(result.current?.defaultWallet).toBe(btcWallet)
    expect(result.current?.bitcoinWallet).toBe(btcWallet)
    expect(result.current?.usdWallet).toBe(usdWallet)
    expect(result.current?.username).toBe("testuser")
    expect(result.current?.posUrl).toBe("https://pay.blink.sv")
    expect(result.current?.lnAddressHostname).toBe("blink.sv")
    expect(result.current?.network).toBe(Network.Mainnet)
    expect(result.current?.convertMoneyAmount).toBe(mockConvertMoneyAmount)
  })

  it("returns feesInformation as undefined when null", () => {
    mockQueryData.mockReturnValue({
      data: {
        me: {
          username: "testuser",
          defaultAccount: {
            wallets: [btcWallet, usdWallet],
            defaultWalletId: "btc-id",
          },
        },
        globals: {
          network: Network.Mainnet,
          feesInformation: null,
        },
      },
    })

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current?.feesInformation).toBeUndefined()
  })

  it("returns null when network is missing from globals", () => {
    mockQueryData.mockReturnValue({
      data: {
        me: {
          username: "testuser",
          defaultAccount: {
            wallets: [btcWallet, usdWallet],
            defaultWalletId: "btc-id",
          },
        },
        globals: null,
      },
    })

    const { result } = renderHook(() => useWalletResolution())

    expect(result.current).toBeNull()
  })
})
