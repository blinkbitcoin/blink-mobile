import { renderHook, act } from "@testing-library/react-native"

import { useMigrationAccount } from "@app/screens/account-migration/hooks/use-migration-account"
import { MigrationCheckpoint } from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockSaveCheckpoint = jest.fn()
const mockProvision = jest.fn()
const mockReportError = jest.fn()
const mockToastShow = jest.fn()
let mockAccountId: string | null = null

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => ({
    accountId: mockAccountId,
    loading: false,
    saveCheckpoint: mockSaveCheckpoint,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-provision-self-custodial-account", () => ({
  useProvisionSelfCustodialAccount: () => ({ provision: mockProvision }),
}))

let mockGuardBlocked = false

jest.mock("@app/hooks/use-in-flight-guard", () => ({
  useInFlightGuard: () => ({
    run: <T>(fn: () => T) => (mockGuardBlocked ? undefined : fn()),
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { AccountTypeSelectionScreen: { createFailed: () => "creation failed" } },
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useMigrationAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = null
    mockGuardBlocked = false
    mockSaveCheckpoint.mockResolvedValue(true)
    mockProvision.mockResolvedValue("sc-account-1")
  })

  it("returns the already provisioned account without provisioning again", async () => {
    mockAccountId = "sc-account-1"
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSaveCheckpoint).not.toHaveBeenCalled()
  })

  it("provisions the account and checkpoints the terms step with its id", async () => {
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = null
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBe("sc-account-1")
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(
      MigrationCheckpoint.TermsAndConditions,
      "sc-account-1",
    )
  })

  it("returns null while another provisioning run is in flight", async () => {
    mockGuardBlocked = true
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it("stops the flow with the failure toast when the checkpoint write fails", async () => {
    mockSaveCheckpoint.mockResolvedValue(false)
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockReportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })

  it("reports the error and returns null when provisioning fails", async () => {
    mockProvision.mockRejectedValue(new Error("provision failed"))
    const { result } = renderHook(() => useMigrationAccount())

    let ensured: string | null = "unset"
    await act(async () => {
      ensured = await result.current.ensureAccount()
    })

    expect(ensured).toBeNull()
    expect(mockReportError).toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalled()
  })
})
