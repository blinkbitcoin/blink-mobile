jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
  BREEZ_NETWORK: "mainnet",
}))

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args: unknown) => args) },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args: unknown) => ({ tag: "Set", inner: args })),
  },
  connect: jest.fn(),
  defaultConfig: jest.fn().mockReturnValue({}),
  initLogging: jest.fn(),
}))

jest.mock("bip39", () => ({
  generateMnemonic: jest.fn().mockReturnValue("word1 word2 word3"),
}))

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    setMnemonic: jest.fn().mockResolvedValue(true),
    setMnemonicNetwork: jest.fn().mockResolvedValue(true),
    deleteMnemonic: jest.fn().mockResolvedValue(true),
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: jest.fn().mockReturnValue({ log: jest.fn() }),
}))

import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"

describe("selfCustodialCreateWallet — mainnet guard", () => {
  it("throws on mainnet in dev builds", async () => {
    await expect(selfCustodialCreateWallet()).rejects.toThrow(
      "Wallet creation is disabled on mainnet in debug builds",
    )
  })
})
