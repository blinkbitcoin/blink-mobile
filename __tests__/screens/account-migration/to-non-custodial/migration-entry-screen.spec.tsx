import React from "react"
import { render } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationEntryScreen } from "@app/screens/account-migration/to-non-custodial/migration-entry-screen"
import {
  MigrationSupportOrigin,
  MigrationSupportReason,
  ServerMigrationFlow,
} from "@app/types/migration"
import { AccountType } from "@app/types/wallet"

const mockReplace = jest.fn()
const mockGoBack = jest.fn()
let mockCanGoBack = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    replace: mockReplace,
    goBack: mockGoBack,
    canGoBack: () => mockCanGoBack,
  }),
}))

let mockActiveAccountType: AccountType = AccountType.Custodial
let mockRegistryLoading = false

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { type: mockActiveAccountType },
    loading: mockRegistryLoading,
  }),
}))

const mockReplaceToCheckpoint = jest.fn()
let mockIsAtCommitPoint = false
/** Kept alongside isAtCommitPoint so a screen wired back to the looser flag fails here
 *  instead of silently resuming a pre-commit checkpoint again (#4109). */
let mockHasResumableCheckpoint = false
let mockIsStartConfirmed = false
let mockCheckpointLoading = false
let mockSelfCustodialDisabled = false
/** Unlocked and not started by default, the state a fresh migration really reads; a test
 *  that needs the server holding a flow says so with holdFlowOnServer. */
let mockFlow: ServerMigrationFlow = ServerMigrationFlow.NotStarted
let mockLockLoading = false

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    flow: mockFlow,
    loading: mockLockLoading,
    refetch: jest.fn(),
  }),
}))

loadLocale("en")
const LL = i18nObject("en")

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))
const mockLL = LL

let mockIsSupportDue = false
jest.mock("@app/screens/account-migration/utils/migration-receive-wait", () => ({
  ...jest.requireActual("@app/screens/account-migration/utils/migration-receive-wait"),
  isMigrationReceiveSupportDue: () => mockIsSupportDue,
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    loading: mockCheckpointLoading,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    isAtCommitPoint: mockIsAtCommitPoint,
    hasResumableCheckpoint: mockHasResumableCheckpoint,
    isStartConfirmed: mockIsStartConfirmed,
  }),
  useSelfCustodialDisabled: () => mockSelfCustodialDisabled,
}))

let mockRemoteConfigReady = true

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => ({
    remoteConfigReady: mockRemoteConfigReady,
    nonCustodialEnabled: true,
  }),
}))

/** The server reports a migration in progress: the account is locked into the flow. */
const holdFlowOnServer = (): void => {
  mockFlow = ServerMigrationFlow.Open
}

describe("MigrationEntryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanGoBack = true
    mockActiveAccountType = AccountType.Custodial
    mockIsAtCommitPoint = false
    mockHasResumableCheckpoint = false
    mockIsStartConfirmed = false
    mockIsSupportDue = false
    mockCheckpointLoading = false
    mockSelfCustodialDisabled = false
    mockFlow = ServerMigrationFlow.NotStarted
    mockLockLoading = false
    mockRemoteConfigReady = true
    mockRegistryLoading = false
  })

  it("renders nothing and starts the flow for a fresh migration", () => {
    const { toJSON } = render(<MigrationEntryScreen />)

    expect(toJSON()).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
  })

  it("resumes at the stored checkpoint once the flow reached the commit point", () => {
    holdFlowOnServer()
    mockIsAtCommitPoint = true
    mockHasResumableCheckpoint = true

    render(<MigrationEntryScreen />)

    expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  /** The flow reopens at its first step, not at the backup screen the user walked away
   *  from, so a provisioned account alone no longer earns a resume (#4109). */
  it("restarts at the gate when the flow was left before the commit point", () => {
    mockHasResumableCheckpoint = true

    render(<MigrationEntryScreen />)

    expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("routes to the gate instead of resuming when the kill-switch is off", () => {
    holdFlowOnServer()
    mockSelfCustodialDisabled = true
    mockIsAtCommitPoint = true

    render(<MigrationEntryScreen />)

    expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("waits for the remote config to resolve before dispatching", () => {
    mockRemoteConfigReady = false
    mockIsAtCommitPoint = true

    render(<MigrationEntryScreen />)

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("waits for the account registry to hydrate before dispatching", () => {
    mockRegistryLoading = true

    render(<MigrationEntryScreen />)

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
  })

  it("waits for the checkpoint to load before dispatching", () => {
    mockCheckpointLoading = true

    render(<MigrationEntryScreen />)

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("bounces a self-custodial account back to the previous screen", () => {
    mockActiveAccountType = AccountType.SelfCustodial

    render(<MigrationEntryScreen />)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("bounces a self-custodial account home when there is nothing to go back to", () => {
    mockActiveAccountType = AccountType.SelfCustodial
    mockCanGoBack = false

    render(<MigrationEntryScreen />)

    expect(mockReplace).toHaveBeenCalledWith("Primary")
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  describe("the server owns whether a migration is still open", () => {
    /** A device that left off on the commit screen: everything local says resume. */
    const arriveWithCommitPointCheckpoint = (): void => {
      mockIsAtCommitPoint = true
      mockHasResumableCheckpoint = true
    }

    it("resumes while the server still holds the flow", () => {
      arriveWithCommitPointCheckpoint()
      holdFlowOnServer()

      render(<MigrationEntryScreen />)

      expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("starts over once support has cleared the flow, whatever the device remembers", () => {
      arriveWithCommitPointCheckpoint()
      mockIsStartConfirmed = true

      render(<MigrationEntryScreen />)

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    /**
     * The funds already moved and the swap into the new wallet is still pending on this
     * device; the background resume finishes it once they land. Resuming would ask the
     * server to start a migration it already finished and hand the user to support, and the
     * gate would walk them into a new run that drops the figure the swap waits on. So the
     * entry says the funds are on their way and leaves the flow alone.
     */
    describe("a completed migration this device has not swapped out of yet", () => {
      const arriveAwaitingSwap = (): void => {
        arriveWithCommitPointCheckpoint()
        mockFlow = ServerMigrationFlow.Completed
      }

      it("says the funds are on their way and goes back, entering no flow", () => {
        arriveAwaitingSwap()

        render(<MigrationEntryScreen />)

        expect(mockToastShow).toHaveBeenCalledWith(
          expect.objectContaining({
            message: LL.AccountMigration.transferDelayed.body(),
          }),
        )
        expect(mockGoBack).toHaveBeenCalledTimes(1)
        expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
      })

      it("goes home when there is nothing to go back to", () => {
        arriveAwaitingSwap()
        mockCanGoBack = false

        render(<MigrationEntryScreen />)

        expect(mockReplace).toHaveBeenCalledWith("Primary")
        expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
      })

      /** Past the notice window, with the app back long enough for a fresh check, the
       *  funds are genuinely late: support takes over, with the delayed reason. */
      it("hands a receive that is genuinely late to support instead", () => {
        arriveAwaitingSwap()
        mockIsSupportDue = true

        render(<MigrationEntryScreen />)

        expect(mockReplace).toHaveBeenCalledWith("accountMigrationContactSupport", {
          reason: MigrationSupportReason.ReceiveDelayed,
          origin: MigrationSupportOrigin.Resume,
        })
        expect(mockToastShow).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
      })

      /** A disabled stack shows the unavailable screen at the gate, whatever the phase. */
      it("leaves the kill-switch in charge", () => {
        arriveAwaitingSwap()
        mockSelfCustodialDisabled = true

        render(<MigrationEntryScreen />)

        expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
        expect(mockToastShow).not.toHaveBeenCalled()
      })
    })

    /** A dollar balance holds the start back after the commit screen recorded its step, and
     *  the conversion that empties it returns here: not started means not started yet, and
     *  the commit screen is where it starts. */
    it("returns to the commit screen when the server never accepted the start", () => {
      arriveWithCommitPointCheckpoint()
      mockIsStartConfirmed = false

      render(<MigrationEntryScreen />)

      expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("waits for the server rather than resuming on a stale record", () => {
      arriveWithCommitPointCheckpoint()
      holdFlowOnServer()
      mockLockLoading = true

      render(<MigrationEntryScreen />)

      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    /** The gate blocks a failed read with a retry, so nothing is decided on a guess. */
    it("hands an unanswered read to the gate instead of resuming on a guess", () => {
      arriveWithCommitPointCheckpoint()
      mockFlow = ServerMigrationFlow.Unanswered

      render(<MigrationEntryScreen />)

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })
  })
})
