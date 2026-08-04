import { renderHook } from "@testing-library/react-native"

import { computeSecurityScore, useSecurityScore } from "@app/hooks/use-security-score"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()
const mockHideBalance = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: mockBackupState() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useHideBalanceQuery: () => ({ data: { hideBalance: mockHideBalance() } }),
}))

const NO_LOCK = { isBiometricsEnabled: false, isPinEnabled: false }

describe("computeSecurityScore", () => {
  const NOTHING_DONE = {
    completedMethods: [],
    isAppLockEnabled: false,
    isHideBalanceEnabled: false,
  }

  it("orders the four signals and marks only backup rows retriggerable", () => {
    const score = computeSecurityScore(NOTHING_DONE)

    expect(score.signals.map((s) => s.key)).toEqual([
      "cloudBackup",
      "manualBackup",
      "appLock",
      "hideBalance",
    ])
    expect(score.signals.map((s) => s.retriggerable)).toEqual([true, true, false, false])
    expect(score.total).toBe(4)
  })

  it("scores 0-1 as low, 2-3 as medium, 4 as high", () => {
    expect(computeSecurityScore(NOTHING_DONE).level).toBe("low")
    expect(computeSecurityScore({ ...NOTHING_DONE, isAppLockEnabled: true }).level).toBe(
      "low",
    )
    expect(
      computeSecurityScore({
        ...NOTHING_DONE,
        isAppLockEnabled: true,
        isHideBalanceEnabled: true,
      }).level,
    ).toBe("medium")
    expect(
      computeSecurityScore({
        completedMethods: ["manual"],
        isAppLockEnabled: true,
        isHideBalanceEnabled: true,
      }).level,
    ).toBe("medium")
    expect(
      computeSecurityScore({
        completedMethods: ["cloud", "manual"],
        isAppLockEnabled: true,
        isHideBalanceEnabled: true,
      }),
    ).toMatchObject({ done: 4, level: "high" })
  })

  it("counts a keychain backup toward the cloud-backup signal", () => {
    const score = computeSecurityScore({
      ...NOTHING_DONE,
      completedMethods: ["keychain"],
    })

    expect(score.signals.find((s) => s.key === "cloudBackup")?.done).toBe(true)
    expect(score.signals.find((s) => s.key === "manualBackup")?.done).toBe(false)
  })
})

describe("useSecurityScore", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
    mockBackupState.mockReturnValue({ status: "none", method: null })
    mockHideBalance.mockReturnValue(false)
  })

  it("returns null for a custodial account", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current).toBeNull()
  })

  it("derives backup signals from legacy single-method state", () => {
    mockBackupState.mockReturnValue({ status: "completed", method: "manual" })

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    const byKey = Object.fromEntries(
      (result.current?.signals ?? []).map((s) => [s.key, s.done]),
    )
    expect(byKey).toEqual({
      cloudBackup: false,
      manualBackup: true,
      appLock: false,
      hideBalance: false,
    })
    expect(result.current?.done).toBe(1)
  })

  it("treats either biometrics or PIN as app lock", () => {
    const { result: biometric } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: true, isPinEnabled: false }),
    )
    const { result: pin } = renderHook(() =>
      useSecurityScore({ isBiometricsEnabled: false, isPinEnabled: true }),
    )

    expect(biometric.current?.signals.find((s) => s.key === "appLock")?.done).toBe(true)
    expect(pin.current?.signals.find((s) => s.key === "appLock")?.done).toBe(true)
  })

  it("reads hide balance from the client-only query", () => {
    mockHideBalance.mockReturnValue(true)

    const { result } = renderHook(() => useSecurityScore(NO_LOCK))

    expect(result.current?.signals.find((s) => s.key === "hideBalance")?.done).toBe(true)
  })
})
