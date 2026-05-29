const mockOpenExternalUrl = jest.fn()

jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => Promise.resolve(mockOpenExternalUrl(...args)),
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: "Mainnet", Regtest: "Regtest" },
}))

const loadUtils = (network: "Mainnet" | "Regtest") => {
  jest.resetModules()
  jest.doMock("@app/self-custodial/config", () => ({
    sparkNetworkFromGaloyInstanceId: () => network,
  }))
  jest.doMock("@app/utils/external", () => ({
    openExternalUrl: (...args: unknown[]) => Promise.resolve(mockOpenExternalUrl(...args)),
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

      openMempoolTx("abc123", "Main")

      expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://mempool.space/tx/abc123")
    })

    it("opens the testnet mempool tx URL when on Regtest", () => {
      const { openMempoolTx } = loadUtils("Regtest")

      openMempoolTx("abc123", "Staging")

      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        "https://mempool.space/testnet/tx/abc123",
      )
    })
  })

  describe("addressPlaceholder", () => {
    it("uses bc1q... on mainnet", () => {
      const { addressPlaceholder } = loadUtils("Mainnet")
      expect(addressPlaceholder("Main")).toBe("bc1q...")
    })

    it("uses bcrt1q... on regtest", () => {
      const { addressPlaceholder } = loadUtils("Regtest")
      expect(addressPlaceholder("Staging")).toBe("bcrt1q...")
    })
  })
})
