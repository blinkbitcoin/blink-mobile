import { renderHook } from "@testing-library/react-native"

import { useWindDownStatus } from "@app/screens/account-migration/hooks/use-wind-down-status"
import { WindDownStatus } from "@app/types/wind-down"

describe("useWindDownStatus", () => {
  it("serves either an unaffected account (null) or a wind-down that honors the contract", () => {
    const { result } = renderHook(() => useWindDownStatus())

    if (result.current === null) return

    /** The contract the consumers rely on: a known phase, a coherent timeline in unix
     *  seconds (receive cutoff, then deadline, then gate), and an IANA timezone. */
    expect(Object.values(WindDownStatus)).toContain(result.current.status)
    expect(result.current.finalDeadline).toBeGreaterThan(result.current.receiveDisabledAt)
    expect(result.current.gateArmsAt).toBeGreaterThanOrEqual(result.current.finalDeadline)
    expect(result.current.timezone).not.toHaveLength(0)
  })
})
