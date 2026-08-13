const mockInitSettings = jest.fn()
const mockRegister = jest.fn()
const mockUnregister = jest.fn()

jest.mock("react-native-screenguard", () => ({
  initSettings: (...args: readonly unknown[]) => mockInitSettings(...args),
  register: (...args: readonly unknown[]) => mockRegister(...args),
  unregister: (...args: readonly unknown[]) => mockUnregister(...args),
}))

/** The util keeps its reference count and call queue in module state, so each test
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

describe("screen-security", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInitSettings.mockResolvedValue(undefined)
    mockRegister.mockResolvedValue(undefined)
    mockUnregister.mockResolvedValue(undefined)
  })

  it("initializes and registers with the given background color on first enable", async () => {
    const { enableScreenSecurity } = loadModule()

    await enableScreenSecurity("#000000")

    expect(mockInitSettings).toHaveBeenCalledTimes(1)
    expect(mockRegister).toHaveBeenCalledWith({ backgroundColor: "#000000" })
  })

  it("unregisters when the last protected screen disables", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()

    await enableScreenSecurity("#000000")
    await disableScreenSecurity()

    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })

  /** Back-navigation scenario: the confirm screen is pushed on top of the phrase
   *  screen; its unmount must not tear down the guard for the phrase screen still
   *  showing the seed words underneath. */
  it("keeps the guard registered when a stacked screen unmounts", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()

    await enableScreenSecurity("#000000") // phrase screen mounts
    await enableScreenSecurity("#000000") // confirm screen pushed on top
    await disableScreenSecurity() // confirm screen unmounts on back-navigation

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("unregisters once the last stacked screen unmounts", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()

    await enableScreenSecurity("#000000")
    await enableScreenSecurity("#000000")
    await disableScreenSecurity()
    await disableScreenSecurity()

    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })

  /** Replace scenario: enable awaits initSettings before register (two ticks) while
   *  disable is a single unregister (one tick); without serialization the shorter
   *  disable could resolve after the longer enable and unregister a freshly mounted
   *  screen. The queue must run the native calls in call order. */
  it("serializes register before unregister when enable and disable race", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()

    const enablePromise = enableScreenSecurity("#000000")
    const disablePromise = disableScreenSecurity()
    await Promise.all([enablePromise, disablePromise])

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.invocationCallOrder[0]).toBeLessThan(
      mockUnregister.mock.invocationCallOrder[0],
    )
  })

  it("ignores a disable with no protected screen mounted", async () => {
    const { disableScreenSecurity } = loadModule()

    await disableScreenSecurity()

    expect(mockUnregister).not.toHaveBeenCalled()
  })

  /** Registration state is tracked separately from the screen count: a rejected
   *  register must not leave the module claiming protection that was never
   *  installed. */
  it("does not unregister after a rejected register, since no guard was installed", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    await expect(enableScreenSecurity("#000000")).rejects.toThrow("native failure")
    await disableScreenSecurity()

    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("retries registration on the next enable after a rejected register", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    await expect(enableScreenSecurity("#000000")).rejects.toThrow("native failure")
    await disableScreenSecurity()

    await enableScreenSecurity("#000000")
    expect(mockRegister).toHaveBeenCalledTimes(2)
  })

  /** Finding: the phrase screen's register rejects, the confirm screen is pushed on
   *  top, and its enable must retry the registration rather than early-returning on a
   *  count that claims protection which was never installed. */
  it("registers for a screen pushed after another screen's registration failed", async () => {
    const { enableScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    await expect(enableScreenSecurity("#000000")).rejects.toThrow("native failure")
    await enableScreenSecurity("#000000")

    expect(mockRegister).toHaveBeenCalledTimes(2)
  })

  /** The replace path unmounts one protected screen as another mounts; the queued
   *  disable sees the arriving screen and skips the unregister/register churn. */
  it("does not churn the guard when one protected screen replaces another", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()

    const first = enableScreenSecurity("#000000")
    const leaving = disableScreenSecurity()
    const arriving = enableScreenSecurity("#000000")
    await Promise.all([first, leaving, arriving])

    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockUnregister).not.toHaveBeenCalled()
  })

  it("keeps processing the queue after a native call rejects", async () => {
    const { enableScreenSecurity, disableScreenSecurity } = loadModule()
    mockRegister.mockRejectedValueOnce(new Error("native failure"))

    await expect(enableScreenSecurity("#000000")).rejects.toThrow("native failure")

    await enableScreenSecurity("#000000")
    await disableScreenSecurity()
    await disableScreenSecurity()

    expect(mockRegister).toHaveBeenCalledTimes(2)
    expect(mockUnregister).toHaveBeenCalledTimes(1)
  })
})
