import { resolveMintOrigin } from "@app/screens/card-screen/onboarding/investment-flow/esign-mint"

const CONFIGURED_ORIGIN = "https://esign.example.test"

/** Restored after each test: the flag is global, and a suite that left it flipped would
 *  change how every module loaded afterwards behaves. */
const devFlag = globalThis as unknown as { __DEV__: boolean }

const withDevFlag = (isDev: boolean, assert: () => void) => {
  const wasDev = devFlag.__DEV__
  devFlag.__DEV__ = isDev

  try {
    assert()
  } finally {
    devFlag.__DEV__ = wasDev
  }
}

describe("resolveMintOrigin", () => {
  it("uses the origin the instance names", () => {
    expect(resolveMintOrigin(CONFIGURED_ORIGIN)).toBe(CONFIGURED_ORIGIN)
  })

  /** No instance names one yet, so this is what lets the flow be exercised against the
   *  reference backend running on the developer's own machine. */
  it("falls back to the local mint in a debug build", () => {
    withDevFlag(true, () => {
      expect(resolveMintOrigin("")).toMatch(/^http:\/\/.+:4100$/)
    })
  })

  /**
   * The fallback address is the developer's own machine. Shipping it would point every
   * user's phone at their own device, so a release build answers with nothing and the
   * step reports a mint it cannot reach.
   */
  it("offers no fallback in a release build", () => {
    withDevFlag(false, () => {
      expect(resolveMintOrigin("")).toBe("")
    })
  })

  it("still prefers a named origin in a release build", () => {
    withDevFlag(false, () => {
      expect(resolveMintOrigin(CONFIGURED_ORIGIN)).toBe(CONFIGURED_ORIGIN)
    })
  })
})
