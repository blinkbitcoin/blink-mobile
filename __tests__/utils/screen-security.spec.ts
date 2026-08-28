const mockInitSettings = jest.fn()
const mockRegister = jest.fn()
const mockUnregister = jest.fn()

jest.mock("react-native-screenguard", () => ({
  initSettings: (...args: readonly unknown[]) => mockInitSettings(...args),
  register: (...args: readonly unknown[]) => mockRegister(...args),
  unregister: (...args: readonly unknown[]) => mockUnregister(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

/** The manager keeps its lease count and call queue in module state, so each test
 *  loads a fresh copy. */
const loadModule = (): typeof import("@app/utils/screen-security") => {
  let mod: typeof import("@app/utils/screen-security") | undefined
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("@app/utils/screen-security")
  })
  if (!mod) throw new Error("failed to load screen-security module")
  return mod
}

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Tracks whether a lease's ready promise has settled, and how. */
const settlementOf = (ready: Promise<void>) => {
  const settled = jest.fn()
  ready.then(
    () => settled("resolved"),
    () => settled("rejected"),
  )
  return settled
}

// Must match ENABLE_RETRY_DELAY_MS / ENABLE_RETRY_LIMIT in the manager; a change
// there should fail here.
const RETRY_DELAY_MS = 10_000
const RETRY_LIMIT = 3

describe("screen-security", () => {
  beforeEach(() => {
    // resetAllMocks (not clear) so a once-implementation left unconsumed by a
    // failing test cannot leak into the next one; defaults are re-applied below.
    jest.resetAllMocks()
    // Fake timers keep a retry scheduled by a rejected registration inert unless
    // the test advances the clock — otherwise a stray timer from one isolated
    // module could fire mid-test in another and pollute the call counts.
    jest.useFakeTimers()
    mockInitSettings.mockResolvedValue(undefined)
    mockRegister.mockResolvedValue(undefined)
    mockUnregister.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("initializes and registers with the given background color, then resolves ready", async () => {
    const { acquireScreenSecurity } = loadModule()

    const lease = acquireScreenSecurity("#000000")
    await lease.ready

    expect(mockInitSettings).toHaveBeenCalledTimes(1)
    expect(mockRegister).toHaveBeenCalledWith({ backgroundColor: "#000000" })
  })

  it("unregisters when the last lease releases", async () => {
    const { acquireScreenSecurity } = loadModule()

    const lease = acquireScreenSecurity("#000000")
    await lease.ready
    await lease.release()

    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })

  /** Back-navigation scenario: the confirm screen is pushed on top of the phrase
   *  screen; its release must not tear down the guard for the phrase screen still
   *  showing the seed words underneath. */
  it("keeps the guard registered when a stacked screen releases", async () => {
    const { acquireScreenSecurity } = loadModule()

    const phrase = acquireScreenSecurity("#000000")
    const confirm = acquireScreenSecurity("#000000") // pushed on top
    await Promise.all([phrase.ready, confirm.ready])
    await confirm.release() // confirm screen unmounts on back-navigation

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("unregisters once the last stacked lease releases", async () => {
    const { acquireScreenSecurity } = loadModule()

    const first = acquireScreenSecurity("#000000")
    const second = acquireScreenSecurity("#000000")
    await Promise.all([first.ready, second.ready])
    await first.release()
    await second.release()

    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })

  it("shares one in-flight registration between concurrent leases", async () => {
    const { acquireScreenSecurity } = loadModule()
    const pendingRegister = deferred<void>()
    mockRegister.mockReturnValueOnce(pendingRegister.promise)

    const first = acquireScreenSecurity("#000000")
    const second = acquireScreenSecurity("#000000")
    await jest.advanceTimersByTimeAsync(0)

    expect(mockRegister).toHaveBeenCalledTimes(1)

    pendingRegister.resolve(undefined)
    await Promise.all([first.ready, second.ready])
  })

  it("makes no native calls for a lease released before its registration ran", async () => {
    const { acquireScreenSecurity } = loadModule()

    const lease = acquireScreenSecurity("#000000")
    await lease.release()

    expect(mockInitSettings).not.toHaveBeenCalled()
    expect(mockRegister).not.toHaveBeenCalled()
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  /** Replace scenario: one protected screen unmounts as another mounts; the queued
   *  teardown sees the arriving lease and skips the unregister/register churn. */
  it("does not churn the guard when one protected screen replaces another", async () => {
    const { acquireScreenSecurity } = loadModule()

    const leaving = acquireScreenSecurity("#000000")
    const releasePromise = leaving.release()
    const arriving = acquireScreenSecurity("#000000")
    await Promise.all([releasePromise, arriving.ready])

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  /** A lease acquired after release() but before the queued teardown runs cancels
   *  the teardown at the run-time lease-count check — the guard simply stays on. */
  it("cancels a queued teardown when a lease arrives before it runs", async () => {
    const { acquireScreenSecurity } = loadModule()

    const first = acquireScreenSecurity("#000000")
    await first.ready

    const releasePromise = first.release()
    const second = acquireScreenSecurity("#000000")
    await Promise.all([releasePromise, second.ready])

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  /** Once the teardown has started, the unregister runs inside the serialized
   *  queue while `registered` still reads true; a lease acquired in that window
   *  must re-register behind the teardown rather than trust a flag that is about
   *  to go stale. */
  it("re-registers when a lease arrives while a teardown is in flight", async () => {
    const { acquireScreenSecurity } = loadModule()
    const pendingUnregister = deferred<void>()

    const first = acquireScreenSecurity("#000000")
    await first.ready

    mockUnregister.mockReturnValueOnce(pendingUnregister.promise)
    const releasePromise = first.release()
    // Let the queued teardown start and block inside the native unregister.
    await jest.advanceTimersByTimeAsync(0)
    expect(mockUnregister).toHaveBeenCalledTimes(1)

    const second = acquireScreenSecurity("#000000")
    const secondSettled = settlementOf(second.ready)
    await jest.advanceTimersByTimeAsync(0)

    // The guard is mid-teardown: the arriving lease waits, it does not trust the flag.
    expect(secondSettled).not.toHaveBeenCalled()
    expect(mockRegister).toHaveBeenCalledTimes(1)

    pendingUnregister.resolve(undefined)
    await Promise.all([releasePromise, second.ready])

    expect(mockRegister).toHaveBeenCalledTimes(2)
  })

  it("releases idempotently", async () => {
    const { acquireScreenSecurity } = loadModule()

    const lease = acquireScreenSecurity("#000000")
    await lease.ready
    await Promise.all([lease.release(), lease.release()])

    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })

  /** Registration state is tracked separately from the lease count: a rejected
   *  register must not leave the manager claiming protection that was never
   *  installed. */
  it("does not unregister after an exhausted registration, since no guard was installed", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValue(new Error("native failure"))

    const lease = acquireScreenSecurity("#000000")
    const settled = settlementOf(lease.ready)
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * (RETRY_LIMIT + 1))
    expect(settled).toHaveBeenCalledWith("rejected")
    await lease.release()

    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("starts a fresh registration cycle for the next acquire after exhaustion", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValue(new Error("native failure"))

    const failed = acquireScreenSecurity("#000000")
    const failedSettled = settlementOf(failed.ready)
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * (RETRY_LIMIT + 1))
    expect(failedSettled).toHaveBeenCalledWith("rejected")
    await failed.release()

    mockRegister.mockResolvedValue(undefined)
    const next = acquireScreenSecurity("#000000")
    await next.ready

    expect(mockRegister).toHaveBeenCalledTimes(1 + RETRY_LIMIT + 1)
  })

  /** The phrase screen's registration fails, the confirm screen is pushed on top,
   *  and its lease must join the same cycle and see the same outcome rather than
   *  early-resolving on a count that claims protection which was never installed. */
  it("fails every concurrent lease when the shared cycle is exhausted", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValue(new Error("native failure"))

    const first = acquireScreenSecurity("#000000")
    const second = acquireScreenSecurity("#000000")
    const firstSettled = settlementOf(first.ready)
    const secondSettled = settlementOf(second.ready)
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * (RETRY_LIMIT + 1))

    expect(firstSettled).toHaveBeenCalledWith("rejected")
    expect(secondSettled).toHaveBeenCalledWith("rejected")
  })

  it("resolves ready when a retry succeeds, and not before", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    const lease = acquireScreenSecurity("#000000")
    const settled = settlementOf(lease.ready)
    await jest.advanceTimersByTimeAsync(0)

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(settled).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    expect(mockRegister).toHaveBeenCalledTimes(2)
    expect(settled).toHaveBeenCalledWith("resolved")
  })

  /** Every failed attempt is reported as it happens so monitoring sees the failure
   *  onset, not just the exhaustion up to RETRY_LIMIT × RETRY_DELAY later. */
  it("reports each failed attempt and rejects only once they are exhausted", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValue(new Error("native failure"))

    const lease = acquireScreenSecurity("#000000")
    const settled = settlementOf(lease.ready)

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * (RETRY_LIMIT - 1))
    // Initial attempt plus RETRY_LIMIT - 1 retries have failed; one retry left.
    expect(mockRegister).toHaveBeenCalledTimes(RETRY_LIMIT)
    expect(mockReportError).toHaveBeenCalledTimes(RETRY_LIMIT)
    expect(settled).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2)

    expect(mockRegister).toHaveBeenCalledTimes(1 + RETRY_LIMIT)
    expect(settled).toHaveBeenCalledWith("rejected")
    expect(mockReportError).toHaveBeenCalledTimes(1 + RETRY_LIMIT)
    expect(mockReportError).toHaveBeenNthCalledWith(
      1,
      "Enable screen security",
      expect.any(Error),
    )
  })

  it("cancels a pending retry when the last lease releases", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    const lease = acquireScreenSecurity("#000000")
    await jest.advanceTimersByTimeAsync(0)
    expect(mockRegister).toHaveBeenCalledTimes(1)

    await lease.release()
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * (RETRY_LIMIT + 1))

    expect(mockRegister).toHaveBeenCalledTimes(1)
  })

  /** A rejected register is not the only way initSettings/register can fail: if
   *  initialization itself rejects, the retry starts over from initSettings. */
  it("retries from initSettings when initialization fails", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockInitSettings.mockRejectedValueOnce(new Error("native failure"))

    const lease = acquireScreenSecurity("#000000")
    const settled = settlementOf(lease.ready)
    await jest.advanceTimersByTimeAsync(0)
    expect(mockRegister).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    expect(settled).toHaveBeenCalledWith("resolved")
    expect(mockInitSettings).toHaveBeenCalledTimes(2)
    expect(mockRegister).toHaveBeenCalledTimes(1)
  })

  /** A rejected unregister leaves the native state unknown, and no later release can
   *  reach the queue to retry it. If `registered` stayed true, every later acquire
   *  would skip the register and the JS and native states would stay desynced for
   *  the rest of the process — so the next acquire must re-register. The rejection
   *  still propagates so the hook can report it. */
  it("re-registers on the next acquire after a rejected unregister", async () => {
    const { acquireScreenSecurity } = loadModule()

    const first = acquireScreenSecurity("#000000")
    await first.ready
    mockUnregister.mockRejectedValueOnce(new Error("native failure"))
    await expect(first.release()).rejects.toThrow("native failure")

    const second = acquireScreenSecurity("#000000")
    await second.ready

    expect(mockRegister).toHaveBeenCalledTimes(2)
  })

  it("keeps processing the queue after a native call rejects", async () => {
    const { acquireScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    const first = acquireScreenSecurity("#000000")
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    await first.ready
    await first.release()

    const second = acquireScreenSecurity("#000000")
    await second.ready
    await second.release()

    expect(mockRegister).toHaveBeenCalledTimes(3)
    expect(mockUnregister).toHaveBeenCalledTimes(2)
  })
})
