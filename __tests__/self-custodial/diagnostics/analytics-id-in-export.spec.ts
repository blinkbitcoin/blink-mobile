import { describe, expect, it } from "@jest/globals"

import { shouldIncludeAnalyticsId } from "@app/self-custodial/diagnostics/analytics-id-in-export"
import { AccountMode } from "@app/types/account"

const { Enhanced, Anon } = AccountMode

describe("shouldIncludeAnalyticsId (KB-26)", () => {
  it("includes the id when the only wallet is Enhanced", () => {
    expect(
      shouldIncludeAnalyticsId({ activeMode: Enhanced, selfCustodialModes: [Enhanced] }),
    ).toBe(true)
  })

  it("includes the id when every wallet on the device is Enhanced", () => {
    expect(
      shouldIncludeAnalyticsId({
        activeMode: Enhanced,
        selfCustodialModes: [Enhanced, Enhanced],
      }),
    ).toBe(true)
  })

  it.each([
    ["the active wallet is Incognito", Anon, [Anon]],
    ["the active wallet has no mode yet", null, [null]],
    ["custodial is active", null, [Enhanced]],
  ] as const)("leaves the id out when %s", (_label, activeMode, selfCustodialModes) => {
    expect(shouldIncludeAnalyticsId({ activeMode, selfCustodialModes })).toBe(false)
  })

  it.each([
    ["an Incognito wallet", Anon],
    ["a wallet with no mode yet", null],
  ] as const)(
    "leaves the id out of an Enhanced export when the device also holds %s",
    (_label, otherMode) => {
      expect(
        shouldIncludeAnalyticsId({
          activeMode: Enhanced,
          selfCustodialModes: [Enhanced, otherMode],
        }),
      ).toBe(false)
    },
  )
})
