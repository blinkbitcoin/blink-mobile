import { renderHook } from "@testing-library/react-native"

import { computeSecurityScore, useSecurityScore } from "@app/hooks/use-security-score"
import type { SecuritySignalDescriptor } from "@app/types/security-score"

const mockSelfCustodialSignals = jest.fn()
const mockCustodialSignals = jest.fn()
const mockHideBalanceQuery = jest.fn()

jest.mock("@app/self-custodial/hooks/use-security-signals", () => ({
  useSelfCustodialSecuritySignals: () => mockSelfCustodialSignals(),
}))

jest.mock("@app/custodial/hooks/use-security-signals", () => ({
  useCustodialSecuritySignals: () => mockCustodialSignals(),
}))

jest.mock("@app/graphql/generated", () => ({
  useHideBalanceQuery: () => mockHideBalanceQuery(),
}))

const NO_LOCK = { isBiometricsEnabled: false, isPinEnabled: false }

const signal = (
  key: SecuritySignalDescriptor["key"],
  done = false,
): SecuritySignalDescriptor => ({ key, done, retriggerable: false })

describe("computeSecurityScore", () => {
  it("scores below half as low, below full as medium, full as high", () => {
    const two = [signal("appLock"), signal("hideBalance", true)]

    expect(computeSecurityScore([signal("appLock")]).level).toBe("low")
    expect(computeSecurityScore(two)).toMatchObject({
      done: 1,
      total: 2,
      level: "medium",
    })
    expect(
      computeSecurityScore([signal("appLock", true), signal("hideBalance", true)]).level,
    ).toBe("high")
    expect(
      computeSecurityScore([
        signal("cloudBackup"),
        signal("manualBackup"),
        signal("appLock", true),
        signal("hideBalance"),
      ]).level,
    ).toBe("low")
  })

  it("scores an empty signal list as 0/0 low, not NaN", () => {
    expect(computeSecurityScore([])).toMatchObject({ done: 0, total: 0, level: "low" })
  })
})

describe("useSecurityScore", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelfCustodialSignals.mockReturnValue(null)
    mockCustodialSignals.mockReturnValue(null)
    mockHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })
  })

  it("returns null when neither mode contributes — no active account", () => {
    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current).toBeNull()
  })

  it("puts self-custodial signals before the shared device signals", () => {
    mockSelfCustodialSignals.mockReturnValue([
      { key: "manualBackup", done: true, retriggerable: true },
      { key: "cloudBackup", done: false, retriggerable: true },
    ])

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current?.signals.map((s) => s.key)).toEqual([
      "manualBackup",
      "cloudBackup",
      "appLock",
      "hideBalance",
    ])
    expect(result.current?.done).toBe(1)
    expect(result.current?.total).toBe(4)
  })

  it("puts custodial signals before the shared device signals", () => {
    mockCustodialSignals.mockReturnValue([
      signal("twoFactor", true),
      signal("emailVerified"),
    ])

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current?.signals.map((s) => s.key)).toEqual([
      "twoFactor",
      "emailVerified",
      "appLock",
      "hideBalance",
    ])
  })

  it("scores a level-0 custodial account on device signals alone", () => {
    mockCustodialSignals.mockReturnValue([])

    const { result } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: true, isPinEnabled: false }),
    )

    expect(result.current).toMatchObject({ done: 1, total: 2, level: "medium" })
  })

  it("reaches high on a level-0 custodial account with both device signals", () => {
    mockCustodialSignals.mockReturnValue([])
    mockHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

    const { result } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: false, isPinEnabled: true }),
    )

    expect(result.current).toMatchObject({ done: 2, total: 2, level: "high" })
  })

  it("treats either biometrics or PIN as app lock", () => {
    mockCustodialSignals.mockReturnValue([])

    const { result: biometric } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: true, isPinEnabled: false }),
    )
    const { result: pin } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: false, isPinEnabled: true }),
    )

    expect(biometric.current?.signals.find((s) => s.key === "appLock")?.done).toBe(true)
    expect(pin.current?.signals.find((s) => s.key === "appLock")?.done).toBe(true)
  })

  it("treats a not-yet-loaded hide-balance query as not hidden", () => {
    mockCustodialSignals.mockReturnValue([])
    mockHideBalanceQuery.mockReturnValue({})

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current?.signals.find((s) => s.key === "hideBalance")?.done).toBe(false)
  })
})
