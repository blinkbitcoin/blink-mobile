import { renderHook } from "@testing-library/react-native"
import { useEffect, useRef } from "react"

type Flags = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  hasCustodialAccount: boolean
}

const useRolloutExposureLogger = (
  remoteConfigReady: boolean,
  flags: Flags,
  log: (f: Flags) => void,
) => {
  const rolloutLoggedRef = useRef(false)
  useEffect(
    () => {
      if (!remoteConfigReady) return
      if (rolloutLoggedRef.current) return
      rolloutLoggedRef.current = true
      log(flags)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      remoteConfigReady,
      flags.nonCustodialEnabled,
      flags.stableBalanceEnabled,
      flags.hasCustodialAccount,
      log,
    ],
  )
}

const baseFlags: Flags = {
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
  hasCustodialAccount: false,
}

describe("rolloutLoggedRef once-per-session dedup (Important #12)", () => {
  it("does not log while remoteConfigReady is false", () => {
    const log = jest.fn()
    renderHook(() => useRolloutExposureLogger(false, baseFlags, log))

    expect(log).not.toHaveBeenCalled()
  })

  it("logs exactly once when remoteConfigReady transitions from false to true", () => {
    const log = jest.fn()
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useRolloutExposureLogger(ready, baseFlags, log),
      { initialProps: { ready: false } },
    )

    expect(log).not.toHaveBeenCalled()

    rerender({ ready: true })

    expect(log).toHaveBeenCalledTimes(1)
  })

  it("logs the snapshot of flags captured at the moment of readiness", () => {
    const log = jest.fn()
    const flags: Flags = {
      nonCustodialEnabled: true,
      stableBalanceEnabled: true,
      hasCustodialAccount: false,
    }

    renderHook(() => useRolloutExposureLogger(true, flags, log))

    expect(log).toHaveBeenCalledWith(flags)
  })

  it("does not re-log when nonCustodialEnabled flips after readiness", () => {
    const log = jest.fn()
    const { rerender } = renderHook(
      ({ flags }: { flags: Flags }) => useRolloutExposureLogger(true, flags, log),
      { initialProps: { flags: { ...baseFlags, nonCustodialEnabled: false } } },
    )

    expect(log).toHaveBeenCalledTimes(1)

    rerender({ flags: { ...baseFlags, nonCustodialEnabled: true } })
    rerender({ flags: { ...baseFlags, nonCustodialEnabled: false } })

    expect(log).toHaveBeenCalledTimes(1)
  })

  it("does not re-log when stableBalanceEnabled flips after readiness", () => {
    const log = jest.fn()
    const { rerender } = renderHook(
      ({ flags }: { flags: Flags }) => useRolloutExposureLogger(true, flags, log),
      { initialProps: { flags: baseFlags } },
    )

    rerender({ flags: { ...baseFlags, stableBalanceEnabled: true } })
    rerender({ flags: { ...baseFlags, stableBalanceEnabled: false } })

    expect(log).toHaveBeenCalledTimes(1)
  })

  it("does not re-log when hasCustodialAccount flips after readiness", () => {
    const log = jest.fn()
    const { rerender } = renderHook(
      ({ flags }: { flags: Flags }) => useRolloutExposureLogger(true, flags, log),
      { initialProps: { flags: baseFlags } },
    )

    rerender({ flags: { ...baseFlags, hasCustodialAccount: true } })
    rerender({ flags: { ...baseFlags, hasCustodialAccount: false } })

    expect(log).toHaveBeenCalledTimes(1)
  })

  it("does not re-log on a remote-config refresh that flips remoteConfigReady false → true after the first log", () => {
    const log = jest.fn()
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useRolloutExposureLogger(ready, baseFlags, log),
      { initialProps: { ready: true } },
    )

    expect(log).toHaveBeenCalledTimes(1)

    rerender({ ready: false })
    rerender({ ready: true })

    expect(log).toHaveBeenCalledTimes(1)
  })
})
