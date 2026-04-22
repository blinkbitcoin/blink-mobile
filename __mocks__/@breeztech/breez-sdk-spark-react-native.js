/* eslint-disable camelcase */
const SdkEvent_Tags = {
  Synced: "Synced",
  PaymentSucceeded: "PaymentSucceeded",
  PaymentPending: "PaymentPending",
  PaymentFailed: "PaymentFailed",
  ClaimedDeposits: "ClaimedDeposits",
  UnclaimedDeposits: "UnclaimedDeposits",
  Optimization: "Optimization",
  LightningAddressChanged: "LightningAddressChanged",
}

const PaymentDetails_Tags = {
  Spark: "Spark",
  Token: "Token",
  Lightning: "Lightning",
  Withdraw: "Withdraw",
  Deposit: "Deposit",
}

const createInstanceOf = (targetTag) => ({
  instanceOf: (obj) => obj?.tag === targetTag,
})

const PaymentDetails = {
  Lightning: createInstanceOf("Lightning"),
  Spark: createInstanceOf("Spark"),
  Token: createInstanceOf("Token"),
  Deposit: createInstanceOf("Deposit"),
  Withdraw: createInstanceOf("Withdraw"),
}

const SdkError_Tags = {
  SparkError: "SparkError",
  InsufficientFunds: "InsufficientFunds",
  InvalidUuid: "InvalidUuid",
  InvalidInput: "InvalidInput",
  NetworkError: "NetworkError",
  StorageError: "StorageError",
  ChainServiceError: "ChainServiceError",
  MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
  MissingUtxo: "MissingUtxo",
  LnurlError: "LnurlError",
  Signer: "Signer",
  Generic: "Generic",
}

const SdkError = {
  instanceOf: (obj) =>
    Boolean(obj) &&
    typeof obj === "object" &&
    typeof obj.tag === "string" &&
    Object.values(SdkError_Tags).includes(obj.tag),
}

module.exports = {
  connect: jest.fn(),
  defaultConfig: jest.fn().mockReturnValue({}),
  initLogging: jest.fn(),
  BitcoinNetwork: { Bitcoin: 0, Testnet3: 1, Testnet4: 2, Signet: 3, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress", BitcoinAddress: "BitcoinAddress" },
  Network: { Mainnet: 0, Regtest: 1 },
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  SendPaymentOptions: {
    BitcoinAddress: jest.fn().mockImplementation((args) => ({
      tag: "BitcoinAddress",
      ...args,
    })),
  },
  Seed: { Mnemonic: jest.fn().mockImplementation((args) => args) },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args) => ({ tag: "Set", inner: args })),
    Unset: jest.fn().mockImplementation(() => ({ tag: "Unset" })),
  },
  ConversionType: {
    FromBitcoin: jest.fn().mockImplementation(() => ({ tag: "FromBitcoin" })),
    ToBitcoin: jest
      .fn()
      .mockImplementation((args) => ({ tag: "ToBitcoin", inner: args })),
  },
  PrepareSendPaymentRequest: { create: (p) => p },
  SendPaymentRequest: { create: (p) => p },
  ReceivePaymentRequest: { create: (p) => p },
  ReceivePaymentMethod: {
    SparkAddress: jest.fn().mockImplementation(() => ({ tag: "SparkAddress" })),
    SparkInvoice: jest
      .fn()
      .mockImplementation((args) => ({ tag: "SparkInvoice", inner: args })),
    Bolt11Invoice: jest
      .fn()
      .mockImplementation((args) => ({ tag: "Bolt11Invoice", inner: args })),
    BitcoinAddress: jest
      .fn()
      .mockImplementation((args) => ({ tag: "BitcoinAddress", inner: args })),
  },
  SdkEvent_Tags,
  PaymentMethod: {
    Lightning: 0,
    Spark: 1,
    Token: 2,
    Deposit: 3,
    Withdraw: 4,
    Unknown: 5,
  },
  PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
  PaymentType: { Send: 0, Receive: 1 },
  PaymentDetails_Tags,
  PaymentDetails,
  SdkError,
  SdkError_Tags,
  ServiceStatus: {
    Operational: 0,
    Degraded: 1,
    Partial: 2,
    Unknown: 3,
    Major: 4,
  },
  getSparkStatus: jest.fn().mockResolvedValue({ status: 0, lastUpdated: BigInt(0) }),
}
