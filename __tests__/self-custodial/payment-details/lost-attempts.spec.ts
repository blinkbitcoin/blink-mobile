import {
  conversionAttemptRef,
  forgetLostAttemptsOf,
  lostAttemptsFor,
  lostAttemptsTo,
  scopeLostAttemptsTo,
  STORED_ATTEMPTS_READ_TIMEOUT_MS,
  STORED_ATTEMPTS_WRITE_RETRY_DELAY_MS,
  STORED_ATTEMPTS_WRITE_RETRY_MAX_DELAY_MS,
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

  /** A domain names its server in any case: the same recipient typed another way. */
  it("knows a Lightning address whatever the case of its domain", () => {
    remember("alice@Example.COM", { unresolvedSend })

    expect(lostAttemptsTo("alice@example.com")).toEqual({ unresolvedSend })
    expect(lostAttemptsTo(" alice@EXAMPLE.com ")).toEqual({ unresolvedSend })
  })

  /** Another case can name another recipient: never one destination's payment taken for
   *  a send to the other. */
  const otherRecipientInAnotherCase: ReadonlyArray<[string, string, string]> = [
    ["a URL path", "lnurlp://example.com/Alice", "lnurlp://example.com/alice"],
    [
      "a URL path after a user",
      "https://pay@example.com/Alice",
      "https://pay@example.com/alice",
    ],
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

const removeNothing = async () => undefined

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
    remove: removeNothing,
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
      remove: removeNothing,
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

  /** What a write does not keep, the next launch does not know: an app closed before the
   *  next change would start without it. */
  it("tries a failed write again at once on the next change, storing the latest state", async () => {
    jest.useFakeTimers()
    const saves: Array<Map<string, LostAttempts>> = []
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation(
        async (_walletId: string, attempts: Map<string, LostAttempts>) => {
          saves.push(new Map(attempts))
        },
      )
    scopeLostAttemptsTo("wallet-launch-10", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
    lostAttemptsFor("sp1abc").update((current) => ({
      ...current,
      lostSend: lostSend("hash-1"),
    }))
    /** The change itself is written at once; only the retry waits. */
    await jest.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(3)

    const latest = new Map([["sp1abc", { unresolvedSend, lostSend: lostSend("hash-1") }]])
    expect(saves).toEqual([latest, latest])
  })

  it("tries a failed write again at once when a change came while it was in flight", async () => {
    jest.useFakeTimers()
    let failWrite: (reason: Error) => void = () => undefined
    const save = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, reject) => {
            failWrite = reject
          }),
      )
      .mockResolvedValue(undefined)
    scopeLostAttemptsTo("wallet-launch-28", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)
    remember("sp1def", { unresolvedSend })
    failWrite(new Error("disk full"))
    await jest.advanceTimersByTimeAsync(0)

    expect(save).toHaveBeenCalledTimes(3)
    expect(save).toHaveBeenNthCalledWith(
      2,
      "wallet-launch-28",
      new Map([
        ["sp1abc", { unresolvedSend }],
        ["sp1def", { unresolvedSend }],
      ]),
    )
  })

  it("waits a little before it tries a failed write again", async () => {
    jest.useFakeTimers()
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined)
    scopeLostAttemptsTo("wallet-launch-27", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_WRITE_RETRY_DELAY_MS - 1)
    expect(save).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledTimes(2)
  })

  it("keeps trying a write that fails, each wait twice as long as the one before up to the longest", async () => {
    jest.useFakeTimers()
    const failures = 10
    const save = jest.fn().mockResolvedValue(undefined)
    for (let failure = 0; failure < failures; failure += 1) {
      save.mockRejectedValueOnce(new Error("disk full"))
    }
    scopeLostAttemptsTo("wallet-launch-11", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
    const waits: number[] = []
    for (let retry = 0; retry < failures; retry += 1) {
      const delay = Math.min(
        STORED_ATTEMPTS_WRITE_RETRY_DELAY_MS * 2 ** retry,
        STORED_ATTEMPTS_WRITE_RETRY_MAX_DELAY_MS,
      )
      waits.push(delay)
      await jest.advanceTimersByTimeAsync(delay - 1)
      expect(save).toHaveBeenCalledTimes(retry + 1)
      await jest.advanceTimersByTimeAsync(1)
      expect(save).toHaveBeenCalledTimes(retry + 2)
    }
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_WRITE_RETRY_MAX_DELAY_MS * 10)

    expect(waits.at(-1)).toBe(STORED_ATTEMPTS_WRITE_RETRY_MAX_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(failures + 1)
  })

  it("tries a write waiting to be tried again at once on a retry", async () => {
    jest.useFakeTimers()
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined)
    scopeLostAttemptsTo("wallet-launch-24", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
    await lostAttemptsFor("sp1abc").retryStorage()
    await jest.advanceTimersByTimeAsync(0)

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(
      "wallet-launch-24",
      new Map([["sp1abc", { unresolvedSend }]]),
    )
  })

  it("stops trying a write that failed again once the wallet is forgotten", async () => {
    jest.useFakeTimers()
    const save = jest.fn().mockRejectedValue(new Error("disk full"))
    scopeLostAttemptsTo("wallet-launch-14", {
      load: async () => new Map(),
      save,
      remove: removeNothing,
    })

    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)
    forgetLostAttemptsOf("wallet-launch-14")
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_WRITE_RETRY_DELAY_MS * 7)

    expect(save).toHaveBeenCalledTimes(1)
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
      remove: removeNothing,
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
      remove: removeNothing,
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

  it("writes nothing while the read has failed, keeping what storage holds", async () => {
    const save = jest.fn(async () => undefined)
    scopeLostAttemptsTo("wallet-launch-13", {
      load: () => Promise.reject(new Error("io")),
      save,
      remove: removeNothing,
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
      remove: removeNothing,
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

  /** The deletion removes the key while the write is in flight: once the write lands, it
   *  would put the deleted wallet's destinations back. */
  it("removes again what a write in flight stores after the wallet was forgotten", async () => {
    const onDisk = new Map<string, ReadonlyMap<string, LostAttempts>>()
    let landWrite: () => void = () => undefined
    const storage: LostAttemptsStorage = {
      load: async () => new Map(),
      save: (walletId, attempts) =>
        new Promise<void>((resolve) => {
          landWrite = () => {
            onDisk.set(walletId, attempts)
            resolve()
          }
        }),
      remove: async (walletId) => {
        onDisk.delete(walletId)
      },
    }
    scopeLostAttemptsTo("wallet-launch-15", storage)
    remember("sp1abc", { unresolvedSend })
    await nextTurn()

    forgetLostAttemptsOf("wallet-launch-15")
    await storage.remove("wallet-launch-15")
    landWrite()
    await nextTurn()

    expect(onDisk.has("wallet-launch-15")).toBe(false)
  })

  it("keeps removing what a late write stored until the removal is taken", async () => {
    jest.useFakeTimers()
    const onDisk = new Map<string, ReadonlyMap<string, LostAttempts>>()
    let landWrite: () => void = () => undefined
    const remove = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockImplementation(async (walletId: string) => {
        onDisk.delete(walletId)
      })
    scopeLostAttemptsTo("wallet-launch-25", {
      load: async () => new Map(),
      save: (walletId, attempts) =>
        new Promise<void>((resolve) => {
          landWrite = () => {
            onDisk.set(walletId, attempts)
            resolve()
          }
        }),
      remove,
    })
    remember("sp1abc", { unresolvedSend })
    await jest.advanceTimersByTimeAsync(0)

    forgetLostAttemptsOf("wallet-launch-25")
    landWrite()
    await jest.advanceTimersByTimeAsync(0)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(onDisk.has("wallet-launch-25")).toBe(true)
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_WRITE_RETRY_DELAY_MS * 3)

    expect(remove).toHaveBeenCalledTimes(3)
    expect(onDisk.has("wallet-launch-25")).toBe(false)
  })

  it("removes nothing after a write that lands while the wallet is still kept", async () => {
    const remove = jest.fn(async () => undefined)
    scopeLostAttemptsTo("wallet-launch-17", {
      load: async () => new Map(),
      save: async () => undefined,
      remove,
    })

    remember("sp1abc", { unresolvedSend })
    await nextTurn()

    expect(remove).not.toHaveBeenCalled()
  })

  /** The send itself refuses to go out: the queue only orders sends. */
  it("tells the stored attempts unread once the read failed twice", async () => {
    scopeLostAttemptsTo("wallet-launch-6", {
      load: () => Promise.reject(new Error("io")),
      save: async () => undefined,
      remove: removeNothing,
    })

    await expect(lostAttemptsFor("sp1abc").oneAtATime(async () => "ran")).resolves.toBe(
      "ran",
    )
    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(false)
    expect(lostAttemptsTo("sp1abc")).toEqual({})
  })

  it("reads again on a retry once the read failed, restoring and writing as usual after", async () => {
    const { storage: answering, saves } = storageHolding({
      "wallet-launch-20": new Map([["sp1old", { unresolvedSend }]]),
    })
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockImplementation(answering.load)
    scopeLostAttemptsTo("wallet-launch-20", { ...answering, load })
    await nextTurn()
    const handle = lostAttemptsFor("sp1new")
    expect(handle.isStoredRead()).toBe(false)

    await handle.retryStorage()
    remember("sp1new", { unresolvedSend })
    await nextTurn()

    expect(load).toHaveBeenCalledTimes(3)
    expect(handle.isStoredRead()).toBe(true)
    expect(saves.at(-1)).toEqual([
      "wallet-launch-20",
      new Map([
        ["sp1old", { unresolvedSend }],
        ["sp1new", { unresolvedSend }],
      ]),
    ])
  })

  it("reads again on each retry while the read keeps failing", async () => {
    const load = jest.fn().mockRejectedValue(new Error("io"))
    scopeLostAttemptsTo("wallet-launch-21", {
      load,
      save: async () => undefined,
      remove: removeNothing,
    })
    await nextTurn()

    await lostAttemptsFor("sp1abc").retryStorage()
    await lostAttemptsFor("sp1abc").retryStorage()

    expect(load).toHaveBeenCalledTimes(6)
    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(false)
  })

  it("reads nothing again on a retry once read, nor while the read is still waited for", async () => {
    let answer: (stored: Map<string, LostAttempts>) => void = () => undefined
    const load = jest.fn(
      () =>
        new Promise<Map<string, LostAttempts>>((resolve) => {
          answer = resolve
        }),
    )
    scopeLostAttemptsTo("wallet-launch-22", {
      load,
      save: async () => undefined,
      remove: removeNothing,
    })

    await lostAttemptsFor("sp1abc").retryStorage()
    answer(new Map())
    await nextTurn()
    await lostAttemptsFor("sp1abc").retryStorage()

    expect(load).toHaveBeenCalledTimes(1)
  })

  it("waits for a read another retry started, while it runs", async () => {
    let answer: (stored: Map<string, LostAttempts>) => void = () => undefined
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve
          }),
      )
    scopeLostAttemptsTo("wallet-launch-26", {
      load,
      save: async () => undefined,
      remove: removeNothing,
    })
    await nextTurn()

    const first = lostAttemptsFor("sp1abc").retryStorage()
    let isSecondOver = false
    const second = lostAttemptsFor("sp1def")
      .retryStorage()
      .then(() => {
        isSecondOver = true
      })
    await nextTurn()
    expect(isSecondOver).toBe(false)
    answer(new Map())
    await Promise.all([first, second])

    expect(load).toHaveBeenCalledTimes(3)
    expect(lostAttemptsFor("sp1def").isStoredRead()).toBe(true)
  })

  it("waits for a retry's read only so long", async () => {
    jest.useFakeTimers()
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockImplementation(
        () =>
          new Promise(() => {
            /** never answers */
          }),
      )
    scopeLostAttemptsTo("wallet-launch-23", {
      load,
      save: async () => undefined,
      remove: removeNothing,
    })
    await jest.advanceTimersByTimeAsync(0)

    let isRetryOver = false
    lostAttemptsFor("sp1abc")
      .retryStorage()
      .then(() => {
        isRetryOver = true
      })
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_READ_TIMEOUT_MS - 1)
    expect(isRetryOver).toBe(false)
    await jest.advanceTimersByTimeAsync(1)

    expect(isRetryOver).toBe(true)
    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(false)
  })

  it("waits out a read started again that does not answer only once", async () => {
    jest.useFakeTimers()
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error("io"))
      .mockRejectedValueOnce(new Error("io"))
      .mockImplementation(
        () =>
          new Promise(() => {
            /** never answers */
          }),
      )
    scopeLostAttemptsTo("wallet-launch-29", {
      load,
      save: async () => undefined,
      remove: removeNothing,
    })
    await jest.advanceTimersByTimeAsync(0)
    const firstRetry = lostAttemptsFor("sp1abc").retryStorage()
    await jest.advanceTimersByTimeAsync(STORED_ATTEMPTS_READ_TIMEOUT_MS)
    await firstRetry

    let isSecondOver = false
    lostAttemptsFor("sp1abc")
      .retryStorage()
      .then(() => {
        isSecondOver = true
      })
    await jest.advanceTimersByTimeAsync(0)

    expect(isSecondOver).toBe(true)
    expect(load).toHaveBeenCalledTimes(3)
    expect(lostAttemptsFor("sp1abc").isStoredRead()).toBe(false)
  })

  it("has nothing to read again before any wallet connected", async () => {
    let fresh: typeof import("@app/self-custodial/payment-details/lost-attempts")
    jest.isolateModules(() => {
      fresh = jest.requireActual("@app/self-custodial/payment-details/lost-attempts")
    })

    await expect(fresh!.lostAttemptsFor("sp1abc").retryStorage()).resolves.toBeUndefined()
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
