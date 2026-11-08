import { it } from "@jest/globals"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import {
  ALLOWED_ROUTES,
  decideSplash,
  FOREGROUND_GRACE_MS,
  LIVE_CLAIM_MAX_AGE_MS,
} from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/decide-splash"
import { SplashCandidate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/types"

const NOW = 1_700_000_000_000

const candidate = (
  overrides: Partial<SplashCandidate> & {
    amount?: number
    createdAt?: number
    direction?: TxDirection
  } = {},
): SplashCandidate =>
  ({
    paymentType: overrides.paymentType ?? "lightning",
    paymentHash: overrides.paymentHash,
    createdAtIsSettlement: overrides.createdAtIsSettlement,
    claimSeenLive: overrides.claimSeenLive,
    transaction: {
      id: "tx-1",
      direction: overrides.direction ?? TxDirection.Receive,
      createdAt: overrides.createdAt ?? Math.floor(NOW / 1000),
      settlementAmount: overrides.amount ?? 5_000,
      settlementCurrency: WalletCurrency.Btc,
      memo: null,
    },
  }) as SplashCandidate

const decide = (overrides: Partial<Parameters<typeof decideSplash>[0]> = {}) =>
  decideSplash({
    candidate: candidate(),
    foregroundSinceMs: NOW - 60_000,
    nowMs: NOW,
    appActive: true,
    alreadySeen: false,
    enabled: true,
    minSats: 100,
    amountSats: 5_000,
    routeName: "Home",
    keyboardVisible: false,
    appLocked: false,
    ...overrides,
  })

describe("decideSplash", () => {
  it("shows a settled receive on an allowed screen", () => {
    expect(decide().outcome).toBe("show")
  })

  it("drops an outgoing payment", () => {
    expect(
      decide({ candidate: candidate({ direction: TxDirection.Send }) }).outcome,
    ).toBe("skip")
  })

  it("drops a replay of a payment already seen", () => {
    expect(decide({ alreadySeen: true })).toEqual({
      outcome: "skip",
      reason: "already_seen",
    })
  })

  it("drops a payment that settled before the app was in the foreground", () => {
    const createdAt = Math.floor((NOW - FOREGROUND_GRACE_MS - 1) / 1000)
    expect(
      decide({
        foregroundSinceMs: NOW,
        candidate: candidate({ createdAt }),
      }),
    ).toEqual({ outcome: "skip", reason: "settled_before_foreground" })
  })

  it("still shows a custodial on-chain confirmation first seen in the mempool", () => {
    const createdAt = Math.floor((NOW - 24 * 60 * 60 * 1000) / 1000)
    expect(
      decide({
        foregroundSinceMs: NOW,
        candidate: candidate({ paymentType: "onchain", createdAt }),
      }).outcome,
    ).toBe("show")
  })

  it("drops a self-custodial deposit whose settlement time is before the foreground", () => {
    const createdAt = Math.floor((NOW - 24 * 60 * 60 * 1000) / 1000)
    expect(
      decide({
        foregroundSinceMs: NOW,
        candidate: candidate({
          paymentType: "onchain",
          createdAt,
          createdAtIsSettlement: true,
        }),
      }),
    ).toEqual({ outcome: "skip", reason: "settled_before_foreground" })
  })

  it("shows a self-custodial receive seen pending live, though its invoice predates the foreground", () => {
    const createdAt = Math.floor((NOW - 10 * 60 * 1000) / 1000)
    expect(
      decide({
        foregroundSinceMs: NOW,
        candidate: candidate({
          createdAt,
          createdAtIsSettlement: true,
          claimSeenLive: true,
        }),
      }).outcome,
    ).toBe("show")
  })

  it("drops a payment seen pending live once it is older than any invoice the app asks for", () => {
    const createdAt = Math.floor((NOW - LIVE_CLAIM_MAX_AGE_MS - 1000) / 1000)
    expect(
      decide({
        foregroundSinceMs: NOW,
        candidate: candidate({
          createdAt,
          createdAtIsSettlement: true,
          claimSeenLive: true,
        }),
      }),
    ).toEqual({ outcome: "skip", reason: "settled_before_foreground" })
  })

  it("suppresses for each product reason", () => {
    const cases: Array<[Partial<Parameters<typeof decideSplash>[0]>, string]> = [
      [{ enabled: false }, "opted_out"],
      [{ amountSats: 99 }, "below_minimum"],
      [{ amountSats: null }, "below_minimum"],
      [{ routeName: "sendBitcoinDetails" }, "blocked_route"],
      [{ routeName: undefined }, "blocked_route"],
      [{ keyboardVisible: true }, "blocked_route"],
      [{ appLocked: true }, "blocked_route"],
    ]
    cases.forEach(([overrides, reason]) => {
      expect(decide(overrides)).toEqual({ outcome: "suppress", reason })
    })
  })

  it("treats the minimum as inclusive", () => {
    expect(decide({ amountSats: 100, minSats: 100 }).outcome).toBe("show")
  })

  it("allows only the named screens", () => {
    for (const routeName of ALLOWED_ROUTES) {
      expect(decide({ routeName }).outcome).toBe("show")
    }
  })
})
