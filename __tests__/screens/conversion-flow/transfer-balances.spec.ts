import { WalletCurrency } from "@app/graphql/generated"
import {
  destinationChoices,
  flippedPair,
  initialTransferPair,
  nextChoice,
  settlementCurrencyOf,
  sourceChoices,
  withDestination,
  withSource,
} from "@app/screens/conversion-flow/transfer-balances"
import { CARD } from "@app/types/amounts"

const { Btc: BTC, Usd: USD } = WalletCurrency
const ALL = [BTC, USD, CARD]

describe("settlementCurrencyOf", () => {
  it("moves the Card Balance in sats", () => {
    expect(settlementCurrencyOf(CARD)).toBe(BTC)
  })

  it("moves a wallet in its own currency", () => {
    expect(settlementCurrencyOf(BTC)).toBe(BTC)
    expect(settlementCurrencyOf(USD)).toBe(USD)
  })
})

describe("sourceChoices", () => {
  it("offers every balance with somewhere to go", () => {
    expect(sourceChoices({ balances: ALL })).toEqual([BTC, USD, CARD])
  })

  it("offers only the wallets when the Card Balance is the fixed destination", () => {
    expect(sourceChoices({ balances: ALL, destination: CARD })).toEqual([BTC, USD])
  })

  it("leaves out a balance with nowhere to go", () => {
    expect(sourceChoices({ balances: [USD, CARD] })).toEqual([USD])
  })
})

describe("destinationChoices", () => {
  it("offers every other balance from a wallet", () => {
    expect(destinationChoices({ balances: ALL, from: BTC })).toEqual([USD, CARD])
    expect(destinationChoices({ balances: ALL, from: USD })).toEqual([BTC, CARD])
  })

  it("offers only the Bitcoin Balance from the Card Balance, until the dollar rate and fee are decided", () => {
    expect(destinationChoices({ balances: ALL, from: CARD })).toEqual([BTC])
  })

  it("offers only the fixed destination", () => {
    expect(destinationChoices({ balances: ALL, from: BTC, destination: CARD })).toEqual([
      CARD,
    ])
  })
})

describe("nextChoice", () => {
  it("moves on to the next choice", () => {
    expect(nextChoice([BTC, USD, CARD], BTC)).toBe(USD)
  })

  it("wraps around after the last", () => {
    expect(nextChoice([BTC, USD, CARD], CARD)).toBe(BTC)
  })

  it("starts over from a balance that is no choice", () => {
    expect(nextChoice([BTC, USD], CARD)).toBe(BTC)
  })
})

describe("withSource", () => {
  it("keeps the destination while the move is still offered", () => {
    expect(withSource({ from: BTC, to: CARD }, USD, ALL)).toEqual({ from: USD, to: CARD })
  })

  it("moves the destination on when the source takes its place", () => {
    expect(withSource({ from: BTC, to: USD }, USD, ALL)).toEqual({ from: USD, to: BTC })
  })

  it("moves the destination on when the move is not offered", () => {
    expect(withSource({ from: BTC, to: USD }, CARD, ALL)).toEqual({ from: CARD, to: BTC })
  })

  it("swaps the two when no other destination is held", () => {
    expect(withSource({ from: BTC, to: USD }, USD, [USD])).toEqual({ from: USD, to: BTC })
  })
})

describe("withDestination", () => {
  it("keeps the source and takes the destination", () => {
    expect(withDestination({ from: BTC, to: USD }, CARD)).toEqual({ from: BTC, to: CARD })
  })
})

describe("flippedPair", () => {
  it("flips a move offered both ways", () => {
    expect(flippedPair({ from: BTC, to: USD })).toEqual({ from: USD, to: BTC })
    expect(flippedPair({ from: BTC, to: CARD })).toEqual({ from: CARD, to: BTC })
  })

  it("does not flip into a move that is not offered", () => {
    expect(flippedPair({ from: USD, to: CARD })).toBeNull()
  })

  it("does not flip away from a fixed destination", () => {
    expect(flippedPair({ from: BTC, to: CARD }, CARD)).toBeNull()
  })
})

describe("initialTransferPair", () => {
  const noFunds = { [BTC]: 0, [USD]: 0 }

  it("opens from the Bitcoin to the Dollar Balance", () => {
    expect(initialTransferPair({ funds: noFunds, balances: ALL })).toEqual({
      from: BTC,
      to: USD,
    })
  })

  it("opens into the Card Balance when the Dollar Balance is left out", () => {
    expect(initialTransferPair({ funds: noFunds, balances: [BTC, CARD] })).toEqual({
      from: BTC,
      to: CARD,
    })
  })

  it("opens toward the Dollar Balance while the wallets are not known yet", () => {
    expect(initialTransferPair({ funds: noFunds, balances: [] })).toEqual({
      from: BTC,
      to: USD,
    })
  })

  it("opens a drain from the Dollar to the Bitcoin Balance", () => {
    expect(
      initialTransferPair({
        funds: { [BTC]: 10, [USD]: 500 },
        balances: [BTC, USD],
        isDrainConversion: true,
      }),
    ).toEqual({ from: USD, to: BTC })
  })

  it("opens into the fixed Card Balance from the Bitcoin Balance when it holds funds", () => {
    expect(
      initialTransferPair({
        funds: { [BTC]: 10, [USD]: 500 },
        balances: ALL,
        destination: CARD,
      }),
    ).toEqual({ from: BTC, to: CARD })
  })

  it("opens into the fixed Card Balance from the Dollar Balance when only it holds funds", () => {
    expect(
      initialTransferPair({
        funds: { [BTC]: 0, [USD]: 500 },
        balances: ALL,
        destination: CARD,
      }),
    ).toEqual({ from: USD, to: CARD })
  })

  it("opens into the fixed Card Balance from the Bitcoin Balance when neither holds funds", () => {
    expect(
      initialTransferPair({ funds: noFunds, balances: ALL, destination: CARD }),
    ).toEqual({ from: BTC, to: CARD })
  })

  it("keeps the Dollar Balance out of a top-up when it is left out", () => {
    expect(
      initialTransferPair({
        funds: { [BTC]: 0, [USD]: 500 },
        balances: [BTC, CARD],
        destination: CARD,
      }),
    ).toEqual({ from: BTC, to: CARD })
  })
})
