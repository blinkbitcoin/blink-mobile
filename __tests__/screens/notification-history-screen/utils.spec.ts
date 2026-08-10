import { icons } from "@app/components/atomic/galoy-icon"
import { Icon } from "@app/graphql/generated"
import { timeAgo, toGaloyIconName } from "@app/screens/notification-history-screen/utils"

import { UNMAPPED_ICON } from "./helpers"

/** `timeAgo` reads the wall clock, so both ends of the diff have to be pinned. */
const FIXED_NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0)
const FIXED_NOW_SECONDS = Math.floor(FIXED_NOW_MS / 1000)
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR

describe("toGaloyIconName", () => {
  it("replaces every underscore of the enum value", () => {
    expect(toGaloyIconName(Icon.WarningWithBackground)).toBe("warning-with-background")
    expect(toGaloyIconName(Icon.CloseCrossWithBackground)).toBe(
      "close-cross-with-background",
    )
  })

  it("returns the mapped name for a single word enum value", () => {
    expect(toGaloyIconName(Icon.Bell)).toBe("bell")
  })

  it("returns undefined for an icon the app has no asset for", () => {
    expect(UNMAPPED_ICON.toLowerCase() in icons).toBe(false)
    expect(toGaloyIconName(UNMAPPED_ICON)).toBeUndefined()
  })

  it("returns undefined when the notification carries no icon", () => {
    expect(toGaloyIconName(null)).toBeUndefined()
    expect(toGaloyIconName(undefined)).toBeUndefined()
  })
})

describe("timeAgo", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: FIXED_NOW_MS })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const secondsAgo = (seconds: number) => FIXED_NOW_SECONDS - seconds

  it("reports a sub minute difference without a unit", () => {
    expect(timeAgo(secondsAgo(30))).toBe("a few seconds ago")
  })

  it("singularizes and pluralizes minutes", () => {
    expect(timeAgo(secondsAgo(SECONDS_PER_MINUTE))).toBe("1 minute ago")
    expect(timeAgo(secondsAgo(5 * SECONDS_PER_MINUTE))).toBe("5 minutes ago")
  })

  it("singularizes and pluralizes hours", () => {
    expect(timeAgo(secondsAgo(SECONDS_PER_HOUR))).toBe("1 hour ago")
    expect(timeAgo(secondsAgo(3 * SECONDS_PER_HOUR))).toBe("3 hours ago")
  })

  it("singularizes and pluralizes days", () => {
    expect(timeAgo(secondsAgo(SECONDS_PER_DAY))).toBe("1 day ago")
    expect(timeAgo(secondsAgo(4 * SECONDS_PER_DAY))).toBe("4 days ago")
  })
})
