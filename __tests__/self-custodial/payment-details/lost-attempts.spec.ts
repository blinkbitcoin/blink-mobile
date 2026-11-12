import {
  conversionAttemptRef,
  forgetLostAttemptsOf,
  lostAttemptsFor,
  lostAttemptsTo,
  scopeLostAttemptsTo,
  STORED_ATTEMPTS_READ_TIMEOUT_MS,
  withoutSettled,
  type LostAttempts,
  type LostAttemptsStorage,
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

  it("removes accounted-for Spark invoices the same way", () => {
    const withInvoices = (...sparkInvoices: string[]) => ({
      ...lostSend(),
      sparkInvoices,
    })

    const settled = withoutSettled(
      { lostSend: withInvoices("inv-1", "inv-2") },
      { lostSend: withInvoices("inv-1") },
    )

    expect(settled.lostSend?.sparkInvoices).toEqual(["inv-2"])
  })

  it("forgets what the settled attempts were asked for, keeping the rest", () => {
    const settled = withoutSettled(
      {
        lostSend: {
          ...lostSend("hash-1", "hash-2"),
          sparkInvoices: ["inv-1"],
          requestedAs: {
            "hash:hash-1": { entered: "USD:100", settlement: "BTC:100" },
            "hash:hash-2": { entered: "USD:200", settlement: "BTC:200" },
            "invoice:inv-1": { entered: "USD:300", settlement: "BTC:300" },
          },
        },
      },
      { lostSend: lostSend("hash-1") },
    )

    expect(settled.lostSend?.requestedAs).toEqual({
      "hash:hash-2": { entered: "USD:200", settlement: "BTC:200" },
      "invoice:inv-1": { entered: "USD:300", settlement: "BTC:300" },
    })
  })

  it("keeps a lost send with no requests recorded without inventing any", () => {
    const settled = withoutSettled(
      { lostSend: lostSend("hash-1", "hash-2") },
      { lostSend: lostSend("hash-1") },
    )

    expect(settled.lostSend?.requestedAs).toBeUndefined()
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

/** What a wallet left in storage in an earlier app launch, and every save since. */
const storageHolding = (stored: Record<string, Map<string, LostAttempts>> = {}) => {
  const saves: Array<[string, Map<string, LostAttempts>]> = []
  const loads: string[] = []
  const storage: LostAttemptsStorage = {
    load: async (walletId) => {
      loads.push(walletId)
      return new Map(stored[walletId] ?? [])
    },
    save: async (walletId, attempts) => {
      saves.push([walletId, new Map(attempts)])
    },
  }
  return { storage, saves, loads }
}

const nextTurn = () => new Promise(setImmediate)

describe("lost attempts across app launches", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("restores what the wallet left before its first send runs", async () => {
    const { storage } = storageHolding({
      "wallet-launch-1": new Map([["sp1abc", { unresolvedSend }]]),
    })
    scopeLostAttemptsTo("wallet-launch-1", storage)

    const seen = await lostAttemptsFor("sp1abc").oneAtATime(async () =>
      lostAttemptsTo("sp1abc"),
    )

    expect(seen).toEqual({ unresolvedSend })
  })

  it("reads a wallet's storage once per launch, not again on a reconnect", async () => {
    const { storage, loads } = storageHolding()
    scopeLostAttemptsTo("wallet-launch-3", storage)
    scopeLostAttemptsTo("wallet-launch-4", storage)
    scopeLostAttemptsTo("wallet-launch-3", storage)

    expect(loads).toEqual(["wallet-launch-3", "wallet-launch-4"])
  })

  it("stores the latest state for the next launch, once the read has answered", async () => {
    const { storage, saves } = storageHolding()
    scopeLostAttemptsTo("wallet-launch-5", storage)

    remember("sp1abc", { unresolvedSend })
    remember("sp1def", { unresolvedSend })
    lostAttemptsFor("sp1abc").update(() => ({}))
    await nextTurn()

    expect(saves.at(-1)).toEqual([
      "wallet-launch-5",
      new Map([["sp1def", { unresolvedSend }]]),
    ])
  })

  it("never stores this launch's attempts over an earlier launch's not read back yet", async () => {
    let answer: (stored: Map<string, LostAttempts>) => void = () => undefined
    const saves: Array<Map<string, LostAttempts>> = []
    scopeLostAttemptsTo("wallet-launch-9", {
      load: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
      save: async (_walletId, attempts) => {
        saves.push(new Map(attempts))
      },
    })

    remember("sp1new", { unresolvedSend })
    await nextTurn()
    expect(saves).toEqual([])

    answer(new Map([["sp1old", { lostSend: lostSend("hash-old") }]]))
    await nextTurn()

    expect(saves.at(-1)).toEqual(
      new Map<string, LostAttempts>([
        ["sp1new", { unresolvedSend }],
        ["sp1old", { lostSend: lostSend("hash-old") }],
      ]),
    )
  })

  it("keeps storing after a write that failed", async () => {
    const saves: Array<Map<string, LostAttempts>> = []
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation(
        async (_walletId: string, attempts: Map<string, LostAttempts>) => {
          saves.push(new Map(attempts))
        },
      )
    scopeLostAttemptsTo("wallet-launch-10", { load: async () => new Map(), save })

    remember("sp1abc", { unresolvedSend })
    await nextTurn()
    remember("sp1def", { unresolvedSend })
    await nextTurn()

    expect(save).toHaveBeenCalledTimes(2)
    expect(saves).toEqual([
      new Map([
        ["sp1abc", { unresolvedSend }],
        ["sp1def", { unresolvedSend }],
      ]),
    ])
  })

  it("has nothing to read back before any wallet connected", () => {
    let fresh: typeof import("@app/self-custodial/payment-details/lost-attempts")
    jest.isolateModules(() => {
      fresh = jest.requireActual("@app/self-custodial/payment-details/lost-attempts")
    })

    expect(fresh!.lostAttemptsFor("sp1abc").isStoredRead()).toBe(true)
  })

  it("runs a send asked for before any wallet connected, with nothing to wait for", async () => {
    let fresh: typeof import("@app/self-custodial/payment-details/lost-attempts")
    jest.isolateModules(() => {
      fresh = jest.requireActual("@app/self-custodial/payment-details/lost-attempts")
    })

    await expect(
      fresh!.lostAttemptsFor("sp1abc").oneAtATime(async () => "sent"),
    ).resolves.toBe("sent")
  })

  it("goes on without the stored attempts once their read takes too long, and restores them when it answers", async () => {
    jest.useFakeTimers()
    let answer: (stored: Map<string, LostAttempts>) => void = () => undefined
    scopeLostAttemptsTo("wallet-launch-8", {
      load: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
      save: async () => undefined,
    })

    const send = lostAttemptsFor("sp1abc").oneAtATime(async () => "sent")
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_READ_TIMEOUT_MS)
    await expect(send).resolves.toBe("sent")

    answer(new Map([["sp1def", { unresolvedSend }]]))
    await jest.advanceTimersByTimeAsync(0)

    expect(lostAttemptsTo("sp1def")).toEqual({ unresolvedSend })
  })

  it("reads once more before writing when the read failed, and restores what it reads", async () => {
    const saves: Array<Map<string, LostAttempts>> = []
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockResolvedValueOnce(new Map([["sp1old", { unresolvedSend }]]))
    scopeLostAttemptsTo("wallet-launch-12", {
      load,
      save: async (_walletId, attempts) => {
        saves.push(new Map(attempts))
      },
    })

    remember("sp1new", { unresolvedSend })
    await nextTurn()

    expect(load).toHaveBeenCalledTimes(2)
    expect(saves.at(-1)).toEqual(
      new Map([
        ["sp1new", { unresolvedSend }],
        ["sp1old", { unresolvedSend }],
      ]),
    )
  })

  it("writes nothing this launch when the read fails twice, keeping what storage holds", async () => {
    const save = jest.fn(async () => undefined)
    scopeLostAttemptsTo("wallet-launch-13", {
      load: () => Promise.reject(new Error("io")),
      save,
    })

    remember("sp1new", { unresolvedSend })
    await nextTurn()

    expect(save).not.toHaveBeenCalled()
    expect(lostAttemptsTo("sp1new")).toEqual({ unresolvedSend })
  })

  it("tells whether the stored attempts have been read back yet", async () => {
    let answer: (stored: Map<string, LostAttempts>) => void = () => undefined
    scopeLostAttemptsTo("wallet-launch-19", {
      load: () =>
        new Promise((resolve) => {
          answer = resolve
        }),
      save: async () => undefined,
    })

    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(false)
    answer(new Map())
    await nextTurn()

    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(true)
  })

  it("writes nothing more for a forgotten wallet, and a later scope to it starts afresh", async () => {
    const { storage, saves, loads } = storageHolding({
      "wallet-launch-16": new Map([["sp1abc", { unresolvedSend }]]),
    })
    scopeLostAttemptsTo("wallet-launch-16", storage)
    const handleBeforeForget = lostAttemptsFor("sp1abc")
    await handleBeforeForget.oneAtATime(async () => undefined)

    forgetLostAttemptsOf("wallet-launch-16")
    handleBeforeForget.update(() => ({ lostSend: lostSend("hash-late") }))
    await nextTurn()
    expect(saves).toEqual([])

    scopeLostAttemptsTo("wallet-launch-16", storage)
    expect(loads).toEqual(["wallet-launch-16", "wallet-launch-16"])
    forgetLostAttemptsOf("wallet-never-scoped")
  })

  it("still sends when the wallet's storage cannot be read", async () => {
    scopeLostAttemptsTo("wallet-launch-6", {
      load: () => Promise.reject(new Error("io")),
      save: async () => undefined,
    })

    await expect(lostAttemptsFor("sp1abc").oneAtATime(async () => "sent")).resolves.toBe(
      "sent",
    )
    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })
})

describe("a repeat of a send still queued or in flight", () => {
  const heldSend = () => {
    let release: (value: string) => void = () => undefined
    let fail: (reason: Error) => void = () => undefined
    const run = jest.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          release = resolve
          fail = reject
        }),
    )
    return {
      run,
      release: (value: string) => release(value),
      fail: (e: Error) => fail(e),
    }
  }

  it("joins it under the same key and answers with its outcome", async () => {
    const handle = lostAttemptsFor("sp1abc")
    const first = heldSend()
    const repeat = jest.fn(async () => "again")

    const firstResult = handle.oneAtATime(first.run, "key-1")
    const repeatResult = handle.oneAtATime(repeat, "key-1")
    await nextTurn()
    first.release("sent")

    await expect(firstResult).resolves.toBe("sent")
    await expect(repeatResult).resolves.toBe("sent")
    expect(first.run).toHaveBeenCalledTimes(1)
    expect(repeat).not.toHaveBeenCalled()
  })

  it("shares the failure of the send it joined", async () => {
    const handle = lostAttemptsFor("sp1abc")
    const first = heldSend()

    const firstResult = handle.oneAtATime(first.run, "key-1")
    const repeatResult = handle.oneAtATime(async () => "again", "key-1")
    await nextTurn()
    first.fail(new Error("lost"))

    await expect(firstResult).rejects.toThrow("lost")
    await expect(repeatResult).rejects.toThrow("lost")
  })

  it("queues a send under another key behind it instead", async () => {
    const handle = lostAttemptsFor("sp1abc")
    const first = heldSend()
    const other = jest.fn(async () => "other")

    const firstResult = handle.oneAtATime(first.run, "key-1")
    const otherResult = handle.oneAtATime(other, "key-2")
    await nextTurn()
    expect(other).not.toHaveBeenCalled()
    first.release("sent")

    await expect(firstResult).resolves.toBe("sent")
    await expect(otherResult).resolves.toBe("other")
    expect(other).toHaveBeenCalledTimes(1)
  })

  it("runs the same send again once the first is done", async () => {
    const handle = lostAttemptsFor("sp1abc")
    const run = jest.fn(async () => "sent")

    await handle.oneAtATime(run, "key-1")
    await handle.oneAtATime(run, "key-1")

    expect(run).toHaveBeenCalledTimes(2)
  })

  it("joins only within the same destination", async () => {
    const first = heldSend()
    const elsewhere = jest.fn(async () => "elsewhere")

    const firstResult = lostAttemptsFor("sp1abc").oneAtATime(first.run, "key-1")
    const elsewhereResult = lostAttemptsFor("sp1def").oneAtATime(elsewhere, "key-1")

    await expect(elsewhereResult).resolves.toBe("elsewhere")
    first.release("sent")
    await firstResult
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

describe("conversionAttemptRef", () => {
  it("is one holder per wallet, kept while another wallet is connected", () => {
    scopeLostAttemptsTo("wallet-a")
    const walletA = conversionAttemptRef()
    expect(conversionAttemptRef()).toBe(walletA)

    scopeLostAttemptsTo("wallet-b")
    expect(conversionAttemptRef()).not.toBe(walletA)

    scopeLostAttemptsTo("wallet-a")
    expect(conversionAttemptRef()).toBe(walletA)
  })
})
