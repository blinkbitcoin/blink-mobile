import { renderHook } from "@testing-library/react-native"
import { WalletCurrency } from "@app/graphql/generated"

import {
  useSendWallets,
  useSendBalances,
} from "@app/screens/send-bitcoin-screen/hooks/use-send-wallets"

const mockActiveWallet = jest.fn()
const mockIsAuthed = jest.fn()
const mockDetailsQuery = jest.fn()
const mockConfirmationQuery = jest.fn()
const mockUnauthedQuery = jest.fn()
const mockPersistentState = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSendBitcoinDetailsScreenQuery: () => mockDetailsQuery(),
  useSendBitcoinConfirmationScreenQuery: () => mockConfirmationQuery(),
  useHomeUnauthedQuery: () => mockUnauthedQuery(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState(),
    updateState: jest.fn(),
  }),
}))

const btcWallet = {
  id: "btc-w1",
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 5000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
}

const usdWallet = {
  id: "usd-w1",
  walletCurrency: WalletCurrency.Usd,
  balance: { amount: 100, currency: WalletCurrency.Usd, currencyCode: "USD" },
  transactions: [],
}

describe("useSendWallets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUnauthedQuery.mockReturnValue({
      data: { globals: { network: "mainnet" } },
    })
    mockPersistentState.mockReturnValue({})
  })

  it("returns wallets when self-custodial", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      wallets: [btcWallet, usdWallet],
    })
    mockIsAuthed.mockReturnValue(false)
    mockDetailsQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.wallets).toHaveLength(2)
    expect(result.current.defaultWallet?.id).toBe("btc-w1")
    expect(result.current.btcWallet?.id).toBe("btc-w1")
    expect(result.current.network).toBe("mainnet")
    expect(result.current.loading).toBe(false)
  })

  it("returns custodial wallets when authenticated", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      isReady: false,
      wallets: [],
    })
    mockIsAuthed.mockReturnValue(true)
    mockDetailsQuery.mockReturnValue({
      data: {
        me: {
          defaultAccount: {
            defaultWalletId: "cust-btc",
            wallets: [
              { id: "cust-btc", walletCurrency: WalletCurrency.Btc, balance: 10000 },
              { id: "cust-usd", walletCurrency: WalletCurrency.Usd, balance: 500 },
            ],
          },
        },
        globals: { network: "mainnet" },
      },
      loading: false,
    })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.defaultWallet?.id).toBe("cust-btc")
    expect(result.current.btcWallet?.id).toBe("cust-btc")
    expect(result.current.usdWallet?.id).toBe("cust-usd")
    expect(result.current.network).toBe("mainnet")
  })

  it("returns loading true when self-custodial wallet not ready", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      isReady: false,
      wallets: [],
    })
    mockIsAuthed.mockReturnValue(false)
    mockDetailsQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.loading).toBe(true)
  })

  it("defaults self-custodial wallet to BTC", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      wallets: [btcWallet],
    })
    mockIsAuthed.mockReturnValue(false)
    mockDetailsQuery.mockReturnValue({ data: undefined, loading: false })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.defaultWallet?.walletCurrency).toBe(WalletCurrency.Btc)
  })

  it("honors selfCustodialDefaultWalletCurrency from persistent state", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      wallets: [btcWallet, usdWallet],
    })
    mockIsAuthed.mockReturnValue(false)
    mockDetailsQuery.mockReturnValue({ data: undefined, loading: false })
    mockPersistentState.mockReturnValue({ selfCustodialDefaultWalletCurrency: "USD" })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.defaultWallet?.id).toBe("usd-w1")
  })

  it("falls back to BTC when preferred USD wallet is missing", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      isReady: true,
      wallets: [btcWallet],
    })
    mockIsAuthed.mockReturnValue(false)
    mockDetailsQuery.mockReturnValue({ data: undefined, loading: false })
    mockPersistentState.mockReturnValue({ selfCustodialDefaultWalletCurrency: "USD" })

    const { result } = renderHook(() => useSendWallets())

    expect(result.current.defaultWallet?.id).toBe("btc-w1")
  })
})

describe("useSendBalances", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns wallet balances when self-custodial", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      wallets: [btcWallet, usdWallet],
    })
    mockIsAuthed.mockReturnValue(false)
    mockConfirmationQuery.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => useSendBalances())

    expect(result.current.btcWallet?.balance).toBe(5000)
    expect(result.current.usdWallet?.balance).toBe(100)
  })

  it("returns custodial balances when authenticated", () => {
    mockActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      wallets: [],
    })
    mockIsAuthed.mockReturnValue(true)
    mockConfirmationQuery.mockReturnValue({
      data: {
        me: {
          defaultAccount: {
            wallets: [
              { id: "cust-btc", walletCurrency: WalletCurrency.Btc, balance: 10000 },
              { id: "cust-usd", walletCurrency: WalletCurrency.Usd, balance: 500 },
            ],
          },
        },
      },
    })

    const { result } = renderHook(() => useSendBalances())

    expect(result.current.btcWallet?.balance).toBe(10000)
    expect(result.current.usdWallet?.balance).toBe(500)
  })
})
