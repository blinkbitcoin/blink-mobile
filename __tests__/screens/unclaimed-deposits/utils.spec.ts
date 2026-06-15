const mockOpenExternalUrl = jest.fn()

jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: "Mainnet", Regtest: "Regtest" },
}))

const loadUtils = (network: "Mainnet" | "Regtest") => {
  jest.resetModules()
  jest.doMock("@app/self-custodial/config", () => ({
    SparkNetwork: network,
  }))
  jest.doMock("@app/utils/external", () => ({
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
  }))
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@app/screens/unclaimed-deposits/utils")
}

describe("unclaimed-deposits utils", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("openMempoolTx", () => {
    it("opens the mainnet mempool tx URL", () => {
      const { openMempoolTx } = loadUtils("Mainnet")

      openMempoolTx("abc123")

      expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://mempool.space/tx/abc123")
    })

    it("opens the testnet mempool tx URL when on Regtest", () => {
      const { openMempoolTx } = loadUtils("Regtest")

      openMempoolTx("abc123")

      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        "https://mempool.space/testnet/tx/abc123",
      )
    })
  })

  describe("ADDRESS_PLACEHOLDER", () => {
    it("uses bc1q... on mainnet", () => {
      const { ADDRESS_PLACEHOLDER } = loadUtils("Mainnet")
      expect(ADDRESS_PLACEHOLDER).toBe("bc1q...")
    })

    it("uses bcrt1q... on regtest", () => {
      const { ADDRESS_PLACEHOLDER } = loadUtils("Regtest")
      expect(ADDRESS_PLACEHOLDER).toBe("bcrt1q...")
    })
  })
})
