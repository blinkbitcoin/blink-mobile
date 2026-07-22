import { renderHook } from "@testing-library/react-native"

import { useWindDownStatus } from "@app/screens/account-migration/hooks/use-wind-down-status"
import { WindDown, WindDownStatus } from "@app/types/wind-down"

let mockWindDown: WindDown | null = null

jest.mock("@app/screens/account-migration/utils/migration-preview-mock", () => ({
  ...jest.requireActual("@app/screens/account-migration/utils/migration-preview-mock"),
  get windDownMock() {
    return mockWindDown
  },
}))

/** A synthetic affected account with an obviously fabricated but contract-coherent
 *  timeline: receive cutoff, then the final deadline, then the gate arming. */
const affectedWindDown: WindDown = {
  status: WindDownStatus.PreCutoff,
  receiveDisabledAt: 1_790_000_000,
  finalDeadline: 1_790_100_000,
  gateArmsAt: 1_790_200_000,
  timezone: "Europe/Paris",
}

describe("useWindDownStatus", () => {
  it("returns null for an account the wind-down does not affect", () => {
    mockWindDown = null

    const { result } = renderHook(() => useWindDownStatus())

    expect(result.current).toBeNull()
  })

  it("serves an affected account's status on a contract-coherent timeline", () => {
    mockWindDown = affectedWindDown

    const { result } = renderHook(() => useWindDownStatus())

    /** The contract the consumers rely on: a known phase, a coherent timeline in unix
     *  seconds (receive cutoff, then deadline, then gate), and an IANA timezone. */
    expect(Object.values(WindDownStatus)).toContain(result.current?.status)
    expect(result.current?.finalDeadline).toBeGreaterThan(
      result.current?.receiveDisabledAt ?? 0,
    )
    expect(result.current?.gateArmsAt).toBeGreaterThanOrEqual(
      result.current?.finalDeadline ?? 0,
    )
    expect(result.current?.timezone).not.toHaveLength(0)
  })
})
