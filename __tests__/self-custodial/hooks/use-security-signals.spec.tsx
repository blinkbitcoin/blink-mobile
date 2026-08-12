import { renderHook } from "@testing-library/react-native"

import {
  selfCustodialSecuritySignals,
  useSelfCustodialSecuritySignals,
} from "@app/self-custodial/hooks/use-security-signals"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: mockBackupState() }),
}))

describe("selfCustodialSecuritySignals", () => {
  it("orders backup signals first and keeps them retriggerable", () => {
    const signals = selfCustodialSecuritySignals([])

    expect(signals.map((s) => s.key)).toEqual(["manualBackup", "cloudBackup"])
    expect(signals.every((s) => s.retriggerable)).toBe(true)
    expect(signals.every((s) => !s.done)).toBe(true)
  })

  it("counts a keychain backup toward the cloud-backup signal", () => {
    const signals = selfCustodialSecuritySignals(["keychain"])

    expect(signals.find((s) => s.key === "cloudBackup")?.done).toBe(true)
    expect(signals.find((s) => s.key === "manualBackup")?.done).toBe(false)
  })
})

describe("useSelfCustodialSecuritySignals", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
    mockBackupState.mockReturnValue({ status: "none", method: null })
  })

  it("returns null for a custodial account — it contributes nothing there", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })

    const { result } = renderHook(() => useSelfCustodialSecuritySignals())

    expect(result.current).toBeNull()
  })

  it("returns null when there is no active account", () => {
    mockActiveAccount.mockReturnValue(undefined)

    const { result } = renderHook(() => useSelfCustodialSecuritySignals())

    expect(result.current).toBeNull()
  })

  it("derives backup signals from legacy single-method state", () => {
    mockBackupState.mockReturnValue({ status: "completed", method: "manual" })

    const { result } = renderHook(() => useSelfCustodialSecuritySignals())

    expect(result.current?.find((s) => s.key === "manualBackup")?.done).toBe(true)
    expect(result.current?.find((s) => s.key === "cloudBackup")?.done).toBe(false)
  })
})
