import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useTransferWallets } from "@app/screens/conversion-flow/hooks/use-transfer-wallets"
import { CARD } from "@app/types/amounts"

const btcWallet = { id: "btc-wallet", balance: 22, walletCurrency: WalletCurrency.Btc }
const usdWallet = { id: "usd-wallet", balance: 5233, walletCurrency: WalletCurrency.Usd }
const card = { id: "card-1", availableSats: 125000 }

type Input = Parameters<typeof useTransferWallets>[0]

const walletsFor = (overrides: Partial<Input> = {}) =>
  renderHook(() =>
    useTransferWallets({
      btcWallet,
      usdWallet,
      card: undefined,
      destination: undefined,
      isDollarBalanceOffered: true,
      isDrainConversion: false,
      ...overrides,
    }),
  ).result.current

describe("useTransferWallets", () => {
  it("offers the two wallets without a card", () => {
    const { balances, transferWallets } = walletsFor()

    expect(balances).toEqual([WalletCurrency.Btc, WalletCurrency.Usd])
    expect(transferWallets[CARD]).toBeUndefined()
    expect(transferWallets[WalletCurrency.Btc]).toEqual({
      ...btcWallet,
      kind: WalletCurrency.Btc,
    })
  })

  it("adds the Card Balance as a side moving in sats", () => {
    const { balances, transferWallets } = walletsFor({ card })

    expect(balances).toEqual([WalletCurrency.Btc, WalletCurrency.Usd, CARD])
    expect(transferWallets[CARD]).toEqual({
      id: "card-1",
      balance: 125000,
      walletCurrency: WalletCurrency.Btc,
      kind: CARD,
    })
  })

  it("leaves the Dollar Balance out when it is not offered", () => {
    expect(walletsFor({ card, isDollarBalanceOffered: false }).balances).toEqual([
      WalletCurrency.Btc,
      CARD,
    ])
  })

  it("reads a card balance not known yet as nothing to move, and as unknown to show", () => {
    const { transferWallets, balanceAmounts } = walletsFor({
      card: { id: "card-1", availableSats: undefined },
    })

    expect(transferWallets[CARD]?.balance).toBe(0)
    expect(balanceAmounts[CARD].amount).toBeNaN()
  })

  it("tells what each balance holds", () => {
    const { balanceAmounts } = walletsFor({ card })

    expect(balanceAmounts[WalletCurrency.Btc]).toEqual(
      expect.objectContaining({ amount: 22, currency: WalletCurrency.Btc }),
    )
    expect(balanceAmounts[WalletCurrency.Usd]).toEqual(
      expect.objectContaining({ amount: 5233, currency: WalletCurrency.Usd }),
    )
    expect(balanceAmounts[CARD]).toEqual(
      expect.objectContaining({ amount: 125000, currency: WalletCurrency.Btc }),
    )
  })

  it("opens from the Bitcoin to the Dollar Balance, free to flip", () => {
    const { initialWallets, isDirectionFixed } = walletsFor({ card })

    expect(initialWallets?.initialFromWallet.kind).toBe(WalletCurrency.Btc)
    expect(initialWallets?.initialToWallet.kind).toBe(WalletCurrency.Usd)
    expect(initialWallets?.isDirectionFixed).toBe(false)
    expect(isDirectionFixed).toBe(false)
  })

  it("opens into the fixed Card Balance, keeping the direction", () => {
    const { initialWallets, isDirectionFixed } = walletsFor({ card, destination: CARD })

    expect(initialWallets?.initialFromWallet.kind).toBe(WalletCurrency.Btc)
    expect(initialWallets?.initialToWallet.kind).toBe(CARD)
    expect(initialWallets?.isDirectionFixed).toBe(true)
    expect(isDirectionFixed).toBe(true)
  })

  it("opens a drain from the Dollar to the Bitcoin Balance", () => {
    const { initialWallets } = walletsFor({ isDrainConversion: true })

    expect(initialWallets?.initialFromWallet.kind).toBe(WalletCurrency.Usd)
    expect(initialWallets?.initialToWallet.kind).toBe(WalletCurrency.Btc)
  })

  it("opens nothing until both sides are known", () => {
    expect(walletsFor({ btcWallet: undefined }).initialWallets).toBeUndefined()
    expect(walletsFor({ usdWallet: undefined }).initialWallets).toBeUndefined()
  })

  it("counts unknown wallets as empty when choosing where a top-up comes from", () => {
    const { initialWallets } = walletsFor({
      card,
      destination: CARD,
      usdWallet: undefined,
    })

    expect(initialWallets?.initialFromWallet.kind).toBe(WalletCurrency.Btc)
  })
})
