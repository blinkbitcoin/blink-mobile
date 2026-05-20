import { withTimeout } from "@app/utils/with-timeout"

describe("withTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("resolves with the underlying promise value when it settles before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000, "task")

    expect(result).toBe("ok")
  })

  it("rejects with a labelled timeout error when the promise hangs past the limit", async () => {
    const hung = new Promise<string>(() => {
      // intentionally never resolves
    })

    const racing = withTimeout(hung, 5000, "snapshot")

    jest.advanceTimersByTime(5000)

    await expect(racing).rejects.toThrow("snapshot timed out after 5000ms")
  })

  it("propagates the underlying rejection without altering its identity", async () => {
    const cause = new Error("upstream failure")

    await expect(withTimeout(Promise.reject(cause), 1000, "task")).rejects.toBe(cause)
  })

  it("does not fire the timeout once the promise has settled", async () => {
    const settled = withTimeout(Promise.resolve(42), 1000, "task")

    await expect(settled).resolves.toBe(42)

    jest.advanceTimersByTime(2000)
  })
})
