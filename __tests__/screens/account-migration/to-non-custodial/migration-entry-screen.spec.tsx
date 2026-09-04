import React from "react"
import { render } from "@testing-library/react-native"

import { MigrationEntryScreen } from "@app/screens/account-migration/to-non-custodial/migration-entry-screen"
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
let mockCheckpointLoading = false
let mockSelfCustodialDisabled = false
let mockIsLocked = true
let mockLockLoading = false
let mockLockError = false

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    isLocked: mockIsLocked,
    loading: mockLockLoading,
    hasError: mockLockError,
    refetch: jest.fn(),
  }),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    loading: mockCheckpointLoading,
    replaceToCheckpoint: mockReplaceToCheckpoint,
    isAtCommitPoint: mockIsAtCommitPoint,
    hasResumableCheckpoint: mockHasResumableCheckpoint,
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

describe("MigrationEntryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanGoBack = true
    mockActiveAccountType = AccountType.Custodial
    mockIsAtCommitPoint = false
    mockHasResumableCheckpoint = false
    mockCheckpointLoading = false
    mockSelfCustodialDisabled = false
    mockIsLocked = true
    mockLockLoading = false
    mockLockError = false
    mockRemoteConfigReady = true
    mockRegistryLoading = false
  })

  it("renders nothing and starts the flow for a fresh migration", () => {
    const { toJSON } = render(<MigrationEntryScreen />)

    expect(toJSON()).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
  })

  it("resumes at the stored checkpoint once the flow reached the commit point", () => {
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

      render(<MigrationEntryScreen />)

      expect(mockReplaceToCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("starts over once support has cleared the flow, whatever the device remembers", () => {
      arriveWithCommitPointCheckpoint()
      mockIsLocked = false

      render(<MigrationEntryScreen />)

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })

    it("waits for the server rather than resuming on a stale record", () => {
      arriveWithCommitPointCheckpoint()
      mockLockLoading = true

      render(<MigrationEntryScreen />)

      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("starts over when the server could not be asked, never resumes on a guess", () => {
      arriveWithCommitPointCheckpoint()
      mockLockError = true

      render(<MigrationEntryScreen />)

      expect(mockReplace).toHaveBeenCalledWith("accountMigrationStart")
      expect(mockReplaceToCheckpoint).not.toHaveBeenCalled()
    })
  })
})
