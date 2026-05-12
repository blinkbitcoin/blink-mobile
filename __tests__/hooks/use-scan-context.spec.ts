import { renderHook } from "@testing-library/react-native"

import { Network } from "@app/graphql/generated"
import { useScanContext } from "@app/hooks/use-scan-context"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
}))

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockActiveWallet = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
}))

const mockScanningQuery = jest.fn()
const mockHomeUnauthedQuery = jest.fn()
jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useScanningQrCodeScreenQuery: (opts: unknown) => mockScanningQuery(opts),
    useHomeUnauthedQuery: (opts: unknown) => mockHomeUnauthedQuery(opts),
  }
})

jest.mock("@app/self-custodial/config", () => ({
  SparkNetworkLabel: "mainnet",
}))

describe("useScanContext", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockScanningQuery.mockReturnValue({ data: undefined })
    mockHomeUnauthedQuery.mockReturnValue({ data: undefined })
    mockActiveWallet.mockReturnValue({ isSelfCustodial: false, wallets: [] })
  })

  describe("custodial", () => {
    it("maps wallet ids and network from the authed query", () => {
      mockActiveWallet.mockReturnValue({ isSelfCustodial: false, wallets: [] })
      mockScanningQuery.mockReturnValue({
        data: {
          __typename: "Query",
          globals: { __typename: "Globals", network: Network.Mainnet },
          me: {
            __typename: "User",
            id: "me",
            defaultAccount: {
              __typename: "ConsumerAccount",
              id: "acc",
              wallets: [
                { __typename: "BTCWallet", id: "btc-1" },
                { __typename: "UsdWallet", id: "usd-1" },
              ],
            },
            contacts: [],
          },
        },
      })

      const { result } = renderHook(() => useScanContext())

      expect(result.current.myWalletIds).toEqual(["btc-1", "usd-1"])
      expect(result.current.bitcoinNetwork).toBe(Network.Mainnet)
    })

    it("falls back to the unauthed query network when the authed query is unavailable", () => {
      mockUseIsAuthed.mockReturnValue(false)
      mockHomeUnauthedQuery.mockReturnValue({
        data: { globals: { network: Network.Regtest } },
      })

      const { result } = renderHook(() => useScanContext())

      expect(result.current.myWalletIds).toEqual([])
      expect(result.current.bitcoinNetwork).toBe(Network.Regtest)
    })

    it("skips the authed query when the user is not authed", () => {
      mockUseIsAuthed.mockReturnValue(false)
      renderHook(() => useScanContext())

      expect(mockScanningQuery).toHaveBeenCalledWith({ skip: true })
    })

    it("exposes lnurlDomains with [lnAddressHostname, ...LNURL_DOMAINS]", () => {
      const { result } = renderHook(() => useScanContext())

      expect(result.current.lnurlDomains).toEqual([
        "blink.sv",
        "blink.sv",
        "pay.blink.sv",
        "pay.bbw.sv",
      ])
    })
  })

  describe("self-custodial", () => {
    it("maps wallet ids from useActiveWallet and uses SparkNetworkLabel for network", () => {
      mockActiveWallet.mockReturnValue({
        isSelfCustodial: true,
        wallets: [
          { id: "sc-btc", walletCurrency: "BTC", balance: {}, transactions: [] },
          { id: "sc-usd", walletCurrency: "USD", balance: {}, transactions: [] },
        ],
      })

      const { result } = renderHook(() => useScanContext())

      expect(result.current.myWalletIds).toEqual(["sc-btc", "sc-usd"])
      expect(result.current.bitcoinNetwork).toBe(Network.Mainnet)
    })

    it("exposes lnurlDomains as [] (intraledger lookup disabled)", () => {
      mockActiveWallet.mockReturnValue({
        isSelfCustodial: true,
        wallets: [{ id: "sc", walletCurrency: "BTC", balance: {}, transactions: [] }],
      })

      const { result } = renderHook(() => useScanContext())

      expect(result.current.lnurlDomains).toEqual([])
    })

    it("ignores the custodial GraphQL query when self-custodial is active", () => {
      mockActiveWallet.mockReturnValue({
        isSelfCustodial: true,
        wallets: [
          { id: "sc-only", walletCurrency: "BTC", balance: {}, transactions: [] },
        ],
      })
      mockScanningQuery.mockReturnValue({
        data: {
          me: {
            defaultAccount: {
              wallets: [{ id: "custodial-leaked", __typename: "BTCWallet" }],
            },
          },
        },
      })

      const { result } = renderHook(() => useScanContext())

      expect(result.current.myWalletIds).toEqual(["sc-only"])
    })
  })
})
