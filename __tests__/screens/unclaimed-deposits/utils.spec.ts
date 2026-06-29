import { Network } from "@breeztech/breez-sdk-spark-react-native"

const mockOpenExternalUrl = jest.fn()

jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

import {
  addressPlaceholderFor,
  openMempoolTx,
} from "@app/screens/unclaimed-deposits/utils"

describe("unclaimed-deposits utils", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("openMempoolTx", () => {
    it("opens the mainnet mempool tx URL", () => {
      openMempoolTx("abc123", Network.Mainnet)

      expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://mempool.space/tx/abc123")
    })

    it("opens the testnet mempool tx URL on regtest", () => {
      openMempoolTx("abc123", Network.Regtest)

      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        "https://mempool.space/testnet/tx/abc123",
      )
    })
  })

  describe("addressPlaceholderFor", () => {
    it("uses bc1q... on mainnet", () => {
      expect(addressPlaceholderFor(Network.Mainnet)).toBe("bc1q...")
    })

    it("uses bcrt1q... on regtest", () => {
      expect(addressPlaceholderFor(Network.Regtest)).toBe("bcrt1q...")
    })
  })
})
