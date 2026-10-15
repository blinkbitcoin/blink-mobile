import { act, renderHook } from "@testing-library/react-native"
import type { AppStateStatus } from "react-native"

import { MigrationStatus } from "@app/graphql/generated"
import { useResumeCompletedMigration } from "@app/screens/account-migration/hooks/use-resume-completed-migration"
import {
  isMigrationReceiveOverdue,
  isMigrationReceiveSupportDue,
  resetMigrationReceiveWait,
} from "@app/screens/account-migration/utils/migration-receive-wait"
import { MigrationSdkStatus } from "@app/self-custodial/migration-transfer-request"
import { MigrationCompletion } from "@app/types/migration"

/**
 * The resume hook, its receive gate and the shared wait record together, with only the
 * wallet look itself faked: the per-side specs mock one end each, so this is where the
 * seam the migration screens read from is driven the way the app drives it.
 */

const mockCheckReceiveLanded = jest.fn()

jest.mock("@app/self-custodial/migration-transfer-request", () => ({
  ...jest.requireActual("@app/self-custodial/migration-transfer-request"),
  checkMigrationReceiveLanded: (args: unknown) => mockCheckReceiveLanded(args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

/** Mirrored, not imported: reading them from the source would let a change pass. */
const DELAYED_NOTICE_MS = 60_000
const DELAYED_RETRY_MS = 30_000

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({
    selfCustodialDepositClaimLeewayVbyte: 1,
    migrationReceiveDelayedNoticeMs: 60_000,
    migrationDelayedRedirectEnabled: false,
  }),
}))

const mockNavigation = { navigate: jest.fn() }
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
}))

const mockCompleteMigration = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-complete-migration", () => ({
  useCompleteMigration: () => ({
    migrationAccountId: "sc-account-1",
    migrationExpectedReceiveSats: 21000,
    custodialAccountId: "custodial-1",
    migrationLoading: false,
    completeMigration: mockCompleteMigration,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-status", () => ({
  useMigrationStatus: () => ({ status: MigrationStatus.Completed, loading: false }),
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: jest.fn(),
}))

const mockAppStateListeners: Array<(state: AppStateStatus) => void> = []

jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    addEventListener: (_event: string, handler: (state: AppStateStatus) => void) => {
      mockAppStateListeners.push(handler)
      return {
        remove: () => {
          const index = mockAppStateListeners.indexOf(handler)
          if (index !== -1) mockAppStateListeners.splice(index, 1)
        },
      }
    },
  },
}))

const stillEmpty = {
  status: MigrationSdkStatus.Ok,
  value: { hasReceived: false, balanceSats: 0 },
}
const landed = {
  status: MigrationSdkStatus.Ok,
  value: { hasReceived: true, balanceSats: 21000 },
}
const offline = {
  status: MigrationSdkStatus.ConnectionError,
  error: new Error("Network request failed"),
}

/** Lets a released check's promise chain settle and the effects it sets off run. */
const settle = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await settle()
}

const returnToForeground = async () => {
  await act(async () => {
    mockAppStateListeners.forEach((listener) => listener("active"))
  })
  await settle()
}

/** Past the notice window with the funds still missing: what the screens see before the
 *  app goes to the background in each case below. */
const reachOverdueWait = async () => {
  renderHook(() => useResumeCompletedMigration())
  await settle()
  await advance(DELAYED_NOTICE_MS)
  expect(isMigrationReceiveOverdue()).toBe(true)
}

describe("useResumeCompletedMigration with the shared receive wait", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(1_000_000)
    jest.clearAllMocks()
    mockAppStateListeners.length = 0
    mockCheckReceiveLanded.mockResolvedValue(stillEmpty)
    mockCompleteMigration.mockResolvedValue(MigrationCompletion.Completed)
    resetMigrationReceiveWait()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("offers support once the wait is overdue and the wallet still shows nothing", async () => {
    await reachOverdueWait()

    expect(isMigrationReceiveSupportDue()).toBe(true)
  })

  /** The look that fires on return is what decides; until it lands, the user is told the
   *  funds are on their way rather than handed over on a look from before. */
  it("asks the wallet again on return before offering support", async () => {
    await reachOverdueWait()
    let answerRecheck: (value: unknown) => void = () => undefined
    mockCheckReceiveLanded.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerRecheck = resolve
        }),
    )

    await returnToForeground()
    expect(isMigrationReceiveSupportDue()).toBe(false)

    await act(async () => {
      answerRecheck(stillEmpty)
    })
    await settle()
    expect(isMigrationReceiveSupportDue()).toBe(true)
  })

  /** A dead connection on return never saw the wallet, so it cannot say the funds are
   *  still missing: the next look that does get through decides instead. */
  it("does not offer support on a return whose look could not reach the wallet", async () => {
    await reachOverdueWait()
    mockCheckReceiveLanded.mockResolvedValue(offline)

    await returnToForeground()
    expect(isMigrationReceiveSupportDue()).toBe(false)

    mockCheckReceiveLanded.mockResolvedValue(stillEmpty)
    await advance(DELAYED_RETRY_MS)
    expect(isMigrationReceiveSupportDue()).toBe(true)
  })

  it("withdraws the wait when the look on return finds the funds", async () => {
    await reachOverdueWait()
    mockCheckReceiveLanded.mockResolvedValue(landed)

    await returnToForeground()

    expect(isMigrationReceiveOverdue()).toBe(false)
    expect(isMigrationReceiveSupportDue()).toBe(false)
  })
})
