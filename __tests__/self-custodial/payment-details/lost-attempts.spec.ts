import {
  lostAttemptsFor,
  lostAttemptsTo,
  scopeLostAttemptsTo,
  withoutSettled,
} from "@app/self-custodial/payment-details/lost-attempts"

const unresolvedSend = { idempotencyKey: undefined }
const lostSend = (...paymentHashes: string[]) => ({
  startedAtMs: 1,
  walletClockSec: 0,
  paymentHashes,
  sparkInvoices: [],
})
const remember = (destination: string, attempts: object) =>
  lostAttemptsFor(destination).update((current) => ({ ...current, ...attempts }))

let connectedWallets = 0
beforeEach(() => {
  scopeLostAttemptsTo(`wallet-${(connectedWallets += 1)}`)
})

describe("the lost-attempt store", () => {
  /** A QR code often carries an invoice or address upper case, a paste lower case. */
  it("knows a bech32 destination whatever its case", () => {
    remember("lnbc2500u1pvjluez", { unresolvedSend })

    expect(lostAttemptsTo("LNBC2500U1PVJLUEZ")).toEqual({ unresolvedSend })
    expect(lostAttemptsTo(" lnbc2500u1pvjluez ")).toEqual({ unresolvedSend })
  })

  /** Another case can name another recipient: never one destination's payment taken for
   *  a send to the other. */
  const otherRecipientInAnotherCase: ReadonlyArray<[string, string, string]> = [
    ["a URL path", "lnurlp://example.com/Alice", "lnurlp://example.com/alice"],
    ["a Lightning address user", "Alice@example.com", "alice@example.com"],
    [
      "a base58 address",
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      "1boatslrhtknngkdxeeobr76b53lettpyt",
    ],
    ["mixed case, which bech32 never is", "Sp1qQzz", "sp1qqzz"],
  ]
  otherRecipientInAnotherCase.forEach(([kind, given, other]) => {
    it(`keeps ${kind} apart from the same in another case`, () => {
      remember(given, { unresolvedSend })

      expect(lostAttemptsTo(other)).toEqual({})
      expect(lostAttemptsTo(given)).toEqual({ unresolvedSend })
    })
  })

  it("applies a change to what the destination holds when it is written", () => {
    const handle = lostAttemptsFor("lnbc1")
    remember("lnbc1", { lostSend: lostSend("hash-1") })

    handle.update((current) => ({ ...current, unresolvedSend }))

    expect(lostAttemptsTo("lnbc1")).toEqual({
      lostSend: lostSend("hash-1"),
      unresolvedSend,
    })
  })

  it("drops a destination once nothing is left of its lost attempts", () => {
    remember("lnbc1", { lostSend: lostSend("hash-1") })

    lostAttemptsFor("lnbc1").update(() => ({}))

    expect(lostAttemptsTo("lnbc1")).toEqual({})
  })

  it("keeps a wallet's lost attempts across a reconnect of the same wallet", () => {
    scopeLostAttemptsTo("wallet-a")
    remember("sp1abc", { unresolvedSend })

    scopeLostAttemptsTo("wallet-a")

    expect(lostAttemptsTo("sp1abc")).toEqual({ unresolvedSend })
  })

  /** Another wallet never paid them: nothing to look for, nothing to refuse it over. */
  it("holds none of them for another wallet", () => {
    scopeLostAttemptsTo("wallet-a")
    remember("sp1abc", { unresolvedSend })

    scopeLostAttemptsTo("wallet-b")

    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })

  /** Switching away and back must not forget what the first wallet may have paid. */
  it("still holds a wallet's lost attempts after a switch away and back", () => {
    scopeLostAttemptsTo("wallet-a")
    remember("sp1abc", { unresolvedSend })

    scopeLostAttemptsTo("wallet-b")
    scopeLostAttemptsTo("wallet-a")

    expect(lostAttemptsTo("sp1abc")).toEqual({ unresolvedSend })
  })

  /** A send still in flight when the wallet changes writes where its wallet's are. */
  it("lets a handle taken before a switch write only into its own wallet", () => {
    scopeLostAttemptsTo("wallet-a")
    const handle = lostAttemptsFor("sp1abc")

    scopeLostAttemptsTo("wallet-b")
    handle.update((current) => ({ ...current, unresolvedSend }))

    expect(lostAttemptsTo("sp1abc")).toEqual({})
    expect(handle.read()).toEqual({ unresolvedSend })

    scopeLostAttemptsTo("wallet-a")
    expect(lostAttemptsTo("sp1abc")).toEqual({ unresolvedSend })
  })
})

describe("settling lost attempts", () => {
  it("removes only the payments that were accounted for", () => {
    const settled = withoutSettled(
      { lostSend: lostSend("hash-1", "hash-2") },
      { lostSend: lostSend("hash-1") },
    )

    expect(settled.lostSend?.paymentHashes).toEqual(["hash-2"])
  })

  it("leaves an unresolved attempt another send recorded meanwhile", () => {
    const recordedMeanwhile = { idempotencyKey: undefined }

    const settled = withoutSettled(
      { unresolvedSend: recordedMeanwhile },
      { unresolvedSend: { idempotencyKey: undefined } },
    )

    expect(settled.unresolvedSend).toBe(recordedMeanwhile)
  })
})

describe("sends to a destination, one at a time", () => {
  it("runs the next once the one before it finished, however it finished", async () => {
    const order: string[] = []
    const handle = lostAttemptsFor("sp1abc")

    const first = handle.oneAtATime(async () => {
      order.push("first")
      throw new Error("lost")
    })
    const second = handle.oneAtATime(async () => {
      order.push("second")
      return "sent"
    })

    await expect(first).rejects.toThrow("lost")
    await expect(second).resolves.toBe("sent")
    expect(order).toEqual(["first", "second"])
  })

  it("does not hold a send to another wallet's same destination", async () => {
    scopeLostAttemptsTo("wallet-a")
    let release: () => void = () => undefined
    const held = lostAttemptsFor("sp1abc").oneAtATime(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    scopeLostAttemptsTo("wallet-b")
    await expect(lostAttemptsFor("sp1abc").oneAtATime(async () => "sent")).resolves.toBe(
      "sent",
    )

    release()
    await held
  })
})
