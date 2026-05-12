import { TxDirection, TxStatus, WalletCurrency } from "@app/graphql/generated"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

import { mapHomeDataToWalletState } from "@app/custodial/mappers/wallet-state-mapper"

const mockAccountData = {
  me: {
    defaultAccount: {
      wallets: [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 50000 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 1500 },
      ],
      transactions: { edges: [] },
    },
  },
}

const btcOnlyData = {
  me: {
    defaultAccount: {
      wallets: [{ id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 10000 }],
      transactions: { edges: [] },
    },
  },
}

describe("mapHomeDataToWalletState", () => {
  it("returns unavailable when not authed", () => {
    const result = mapHomeDataToWalletState(undefined, {
      loading: false,
      error: false,
      isAuthed: false,
    })

    expect(result.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.accountType).toBe(AccountType.Custodial)
    expect(result.wallets).toHaveLength(0)
  })

  it("returns loading when loading without data", () => {
    const result = mapHomeDataToWalletState(undefined, {
      loading: true,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Loading)
  })

  it("returns error when error without data", () => {
    const result = mapHomeDataToWalletState(undefined, {
      loading: false,
      error: true,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Error)
  })

  it("returns unavailable when account is null", () => {
    const result = mapHomeDataToWalletState({ me: null } as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Unavailable)
  })

  it("returns ready with BTC and USD wallets", () => {
    const result = mapHomeDataToWalletState(mockAccountData as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Ready)
    expect(result.wallets).toHaveLength(2)
    expect(result.wallets[0].walletCurrency).toBe(WalletCurrency.Btc)
    expect(result.wallets[0].balance.amount).toBe(50000)
    expect(result.wallets[1].walletCurrency).toBe(WalletCurrency.Usd)
    expect(result.wallets[1].balance.amount).toBe(1500)
  })

  it("returns ready with BTC-only wallet", () => {
    const result = mapHomeDataToWalletState(btcOnlyData as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Ready)
    expect(result.wallets).toHaveLength(1)
    expect(result.wallets[0].walletCurrency).toBe(WalletCurrency.Btc)
  })

  it("returns ready with USD-only wallet", () => {
    const usdOnlyData = {
      me: {
        defaultAccount: {
          wallets: [{ id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 2000 }],
          transactions: { edges: [] },
        },
      },
    }

    const result = mapHomeDataToWalletState(usdOnlyData as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Ready)
    expect(result.wallets).toHaveLength(1)
    expect(result.wallets[0].walletCurrency).toBe(WalletCurrency.Usd)
    expect(result.wallets[0].balance.amount).toBe(2000)
  })

  it("filters transactions by wallet currency", () => {
    const tx = {
      __typename: "Transaction" as const,
      id: "tx-btc",
      status: TxStatus.Success,
      direction: TxDirection.Receive,
      memo: null,
      createdAt: 1700000000,
      settlementAmount: 1000,
      settlementFee: 0,
      settlementDisplayFee: "0",
      settlementCurrency: WalletCurrency.Btc,
      settlementDisplayAmount: "1.00",
      settlementDisplayCurrency: "USD",
      settlementPrice: {
        __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit" as const,
        base: 100,
        offset: 0,
        currencyUnit: "USD",
        formattedAmount: "1.00",
      },
      initiationVia: {
        __typename: "InitiationViaLn" as const,
        paymentHash: "h",
        paymentRequest: "ln",
      },
      settlementVia: { __typename: "SettlementViaLn" as const, preImage: "p" },
    }

    const dataWithTxs = {
      me: {
        defaultAccount: {
          wallets: [
            { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 5000 },
            { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 100 },
          ],
          transactions: {
            edges: [
              { node: tx },
              { node: { ...tx, id: "tx-usd", settlementCurrency: WalletCurrency.Usd } },
            ],
          },
        },
      },
    }

    const result = mapHomeDataToWalletState(dataWithTxs as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.wallets).toHaveLength(2)
    expect(result.wallets[0].transactions).toHaveLength(1)
    expect(result.wallets[0].transactions[0].id).toBe("tx-btc")
    expect(result.wallets[1].transactions).toHaveLength(1)
    expect(result.wallets[1].transactions[0].id).toBe("tx-usd")
  })

  it("handles missing transactions field", () => {
    const noTxData = {
      me: {
        defaultAccount: {
          wallets: [{ id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 1000 }],
          transactions: null,
        },
      },
    }

    const result = mapHomeDataToWalletState(noTxData as never, {
      loading: false,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Ready)
    expect(result.wallets[0].transactions).toHaveLength(0)
  })

  it("keeps ready when loading with existing data", () => {
    const result = mapHomeDataToWalletState(mockAccountData as never, {
      loading: true,
      error: false,
      isAuthed: true,
    })

    expect(result.status).toBe(ActiveWalletStatus.Ready)
    expect(result.wallets).toHaveLength(2)
  })
})
