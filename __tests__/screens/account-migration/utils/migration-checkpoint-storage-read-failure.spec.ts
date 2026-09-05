/**
 * Guards the seam that hid blink-wip#1211: unlike the spec next door, this one does NOT
 * mock `@app/utils/storage`. It mocks AsyncStorage one layer lower, so the real read
 * helper takes part.
 *
 * That distinction is the whole point. The flow's error handling was covered end to end
 * against a mocked wrapper that rejected on demand, while the real one answered null to
 * every failure — so three layers of handling were verified against a signal production
 * could not send, and a device whose store would not open was read as a device with
 * nothing stored.
 */
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockRemoveItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}))

import {
  MigrationCheckpoint,
  loadCheckpoint,
  loadPendingProvisionedAccounts,
  savePendingProvisionedAccount,
  saveCheckpointToStorage,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const STORAGE_KEY = "migrationCheckpoint_staging"
const PENDING_KEY = "migrationPendingAccounts_staging"

const OWNER_ID = "custodial-owner-1"
const OTHER_OWNER_ID = "custodial-owner-2"
const PROVISIONED_ACCOUNT_ID = "self-custodial-account-1"

const READ_FAILURE = "SQLITE_CORRUPT: unable to open database file"

/** A healthy record at the commit point: what a user stuck mid-migration depends on. */
const healthyCheckpoint = {
  step: MigrationCheckpoint.BalancesOverview,
  savedAt: Date.now(),
  accountId: PROVISIONED_ACCOUNT_ID,
  custodialAccountId: OWNER_ID,
  expectedReceiveSats: 36726,
}

let disk: Record<string, string> = {}
let isStoreUnreadable = false

const readDisk = async (key: string): Promise<string | null> => {
  if (isStoreUnreadable) throw new Error(READ_FAILURE)
  return disk[key] ?? null
}

const storedCheckpoint = (): unknown => JSON.parse(disk[STORAGE_KEY])

beforeEach(() => {
  jest.clearAllMocks()
  isStoreUnreadable = false
  disk = {
    [STORAGE_KEY]: JSON.stringify(healthyCheckpoint),
    [PENDING_KEY]: JSON.stringify({ [OWNER_ID]: PROVISIONED_ACCOUNT_ID }),
  }
  mockGetItem.mockImplementation(readDisk)
  mockSetItem.mockImplementation(async (key: string, value: string) => {
    disk[key] = value
  })
  mockRemoveItem.mockImplementation(async (key: string) => {
    delete disk[key]
  })
})

describe("an unreadable store is not an empty one", () => {
  it("reads both resume sources back while the store is healthy", async () => {
    await expect(loadCheckpoint(STORAGE_KEY)).resolves.toMatchObject({
      accountId: PROVISIONED_ACCOUNT_ID,
    })
    await expect(loadPendingProvisionedAccounts(PENDING_KEY)).resolves.toEqual({
      [OWNER_ID]: PROVISIONED_ACCOUNT_ID,
    })
  })

  it("reports a failed checkpoint read as a failure, not as a missing checkpoint", async () => {
    isStoreUnreadable = true

    await expect(loadCheckpoint(STORAGE_KEY)).rejects.toThrow(READ_FAILURE)
  })

  it("reports a failed pending-wallet read too, so the second resume source survives it", async () => {
    isStoreUnreadable = true

    await expect(loadPendingProvisionedAccounts(PENDING_KEY)).rejects.toThrow(
      READ_FAILURE,
    )
  })

  it("keeps the record on disk through a failed read", async () => {
    isStoreUnreadable = true
    await expect(loadCheckpoint(STORAGE_KEY)).rejects.toThrow(READ_FAILURE)

    isStoreUnreadable = false

    await expect(loadCheckpoint(STORAGE_KEY)).resolves.toMatchObject({
      accountId: PROVISIONED_ACCOUNT_ID,
      expectedReceiveSats: 36726,
    })
  })

  it("refuses to save over a checkpoint it could not read", async () => {
    isStoreUnreadable = true

    await expect(
      saveCheckpointToStorage(STORAGE_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: OWNER_ID,
      }),
    ).rejects.toThrow(READ_FAILURE)
  })

  it("leaves the account id and expected receive intact after that refusal", async () => {
    isStoreUnreadable = true
    await expect(
      saveCheckpointToStorage(STORAGE_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: OWNER_ID,
      }),
    ).rejects.toThrow(READ_FAILURE)

    isStoreUnreadable = false

    expect(storedCheckpoint()).toMatchObject({
      accountId: PROVISIONED_ACCOUNT_ID,
      expectedReceiveSats: 36726,
    })
  })

  it("refuses to save a pending wallet rather than drop the owners it could not read", async () => {
    isStoreUnreadable = true

    await expect(
      savePendingProvisionedAccount(PENDING_KEY, {
        custodialAccountId: OTHER_OWNER_ID,
        accountId: "self-custodial-account-2",
      }),
    ).rejects.toThrow(READ_FAILURE)

    isStoreUnreadable = false

    await expect(loadPendingProvisionedAccounts(PENDING_KEY)).resolves.toEqual({
      [OWNER_ID]: PROVISIONED_ACCOUNT_ID,
    })
  })

  it("reads a truncated checkpoint as absent instead of stranding the key", async () => {
    disk[STORAGE_KEY] = '{"step":"balancesOverview","savedAt"'

    await expect(loadCheckpoint(STORAGE_KEY)).resolves.toBeNull()
  })

  it("lets the next save repair a truncated checkpoint", async () => {
    disk[STORAGE_KEY] = '{"step":"balancesOverview","savedAt"'

    await saveCheckpointToStorage(STORAGE_KEY, {
      step: MigrationCheckpoint.BalancesOverview,
      accountId: PROVISIONED_ACCOUNT_ID,
      custodialAccountId: OWNER_ID,
    })

    await expect(loadCheckpoint(STORAGE_KEY)).resolves.toMatchObject({
      accountId: PROVISIONED_ACCOUNT_ID,
    })
  })

  it("lets the next save repair a truncated pending-wallet record", async () => {
    disk[PENDING_KEY] = '{"custodial-owner-1"'

    await savePendingProvisionedAccount(PENDING_KEY, {
      custodialAccountId: OWNER_ID,
      accountId: PROVISIONED_ACCOUNT_ID,
    })

    await expect(loadPendingProvisionedAccounts(PENDING_KEY)).resolves.toEqual({
      [OWNER_ID]: PROVISIONED_ACCOUNT_ID,
    })
  })

  it("still saves normally once the store answers", async () => {
    await saveCheckpointToStorage(STORAGE_KEY, {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: OWNER_ID,
    })

    expect(storedCheckpoint()).toMatchObject({
      accountId: PROVISIONED_ACCOUNT_ID,
      expectedReceiveSats: 36726,
    })
  })
})
