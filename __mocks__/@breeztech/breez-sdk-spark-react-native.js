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

module.exports = {
  connect: jest.fn(),
  defaultConfig: jest.fn().mockReturnValue({}),
  initLogging: jest.fn(),
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args) => args) },
  StableBalanceActiveLabel: {
    Set: jest.fn().mockImplementation((args) => ({ tag: "Set", inner: args })),
    Unset: jest.fn().mockReturnValue({ tag: "Unset" }),
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
}
