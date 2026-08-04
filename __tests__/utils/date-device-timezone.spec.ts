/**
 * @jest-environment ./jest.timezone-environment
 */

import { formatUnixTimestampYMDHM } from "@app/utils/date"

/**
 * The sibling `date.spec.ts` pins a zone through the formatter's own `timezone` argument,
 * which leaves the default path unguarded: on a UTC runner an expectation derived from the
 * process zone is UTC either way, so a regression to a hardcoded UTC would still pass. This
 * file runs under a process zone pinned to UTC-6 by `jest.timezone-environment.js`, so the
 * wall clock below is six hours behind the timestamp and only holds while the default path
 * really follows the device.
 */
describe("formatUnixTimestampYMDHM without an injected timezone", () => {
  it("renders the device wall clock rather than UTC", () => {
    const timestampSeconds = Math.floor(Date.parse("2026-08-03T19:04:00Z") / 1000)

    expect(formatUnixTimestampYMDHM({ timestampSeconds })).toBe("2026-08-03 13:04")
  })
})
