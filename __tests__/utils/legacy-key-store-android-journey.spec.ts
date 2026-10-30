import { Platform } from "react-native"

import { act, renderHook } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

import useLogout from "@app/hooks/use-logout"
import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"
import { useRemoveStoredWallets } from "@app/self-custodial/hooks/use-remove-stored-wallets"
import {
  addSelfCustodialAccountId,
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { readPinLockState } from "@app/screens/authentication-screen/pin-verification"
import { serverFor } from "@app/utils/storage/secure-store"
import KeyStoreWrapper, { GALOY_AUTH_TOKEN_KEY } from "@app/utils/storage/secureStorage"

/**
 * The legacy store as the patched Android module answers it, under the real storage stack
 * and the two ways out that drop the app lock: a logout, and the forgotten-PIN removal of
 * every stored wallet. Only the two stores are faked.
 *
 * The module writes through `SharedPreferences.Editor.commit()`, which applies the edit to
 * the in-memory map before it writes the file and returns false when the file write fails.
 * A commit writes the whole map, and only while memory is ahead of the file
 * (`SharedPreferencesImpl.writeToFile`), so an edit left in memory by a failed commit lands
 * with the next one that succeeds. `patches/react-native-secure-key-store+2.0.10.patch`
 * makes `set` and `remove` reject on that false and undo the refused edit in memory first,
 * so the process never holds what the file does not. These journeys depend on both.
 */

type LegacyPrefs = {
  /** What the running process reads. */
  readonly memory: Map<string, string>
  /** What the next launch reads. */
  readonly file: Map<string, string>
  /** The file can no longer be written, as on a full or failing disk. */
  isFileWriteFailing: boolean
}

const mockLegacyPrefs: LegacyPrefs = {
  memory: new Map(),
  file: new Map(),
  isFileWriteFailing: false,
}

/** The patched module rejects with a bare message, which React Native gives this code. */
const mockCommitRejection = (code: number, message: string) =>
  Object.assign(new Error(`{"code":${code},"api-level":35,"message":${message}}`), {
    code: "EUNSPECIFIED",
  })

/** Memory holds an edit the file does not, from this call or from a commit that failed. */
const mockIsFileBehind = (): boolean =>
  mockLegacyPrefs.memory.size !== mockLegacyPrefs.file.size ||
  [...mockLegacyPrefs.memory].some(
    ([key, value]) => mockLegacyPrefs.file.get(key) !== value,
  )

/** False when the file write failed, like `commit()`. The memory change stays either way. */
const mockCommit = (): boolean => {
  if (!mockIsFileBehind()) return true
  if (mockLegacyPrefs.isFileWriteFailing) return false
  mockLegacyPrefs.file.clear()
  mockLegacyPrefs.memory.forEach((value, key) => mockLegacyPrefs.file.set(key, value))
  return true
}

/** The patched module's commit: an edit the file refused is undone in memory before it
 *  rejects. */
const mockCommitOrUndo = (edit: () => void): boolean => {
  const before = new Map(mockLegacyPrefs.memory)
  edit()
  if (mockCommit()) return true
  mockLegacyPrefs.memory.clear()
  before.forEach((value, key) => mockLegacyPrefs.memory.set(key, value))
  return false
}

const mockNewKeychain = new Map<string, string>()

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: async (key: string) => {
      const value = mockLegacyPrefs.memory.get(key)
      if (value === undefined) {
        throw Object.assign(new Error("key has not been set"), { code: "404" })
      }
      return value
    },
    set: async (key: string, value: string) => {
      const isWritten = mockCommitOrUndo(() => mockLegacyPrefs.memory.set(key, value))
      if (!isWritten) throw mockCommitRejection(9, "write did not reach disk")
      return "stored ciphertext in app storage"
    },
    remove: async (key: string) => {
      const isWritten = mockCommitOrUndo(() => mockLegacyPrefs.memory.delete(key))
      if (!isWritten) throw mockCommitRejection(6, "remove did not reach disk")
      return "cleared alias"
    },
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

/** Kept healthy: the new store lives in another file and already fails closed. */
jest.mock("react-native-keychain", () => ({
  __esModule: true,
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
  getInternetCredentials: async (server: string) => {
    const password = mockNewKeychain.get(server)
    return password === undefined ? false : { server, username: server, password }
  },
  hasInternetCredentials: async ({ server }: { server: string }) =>
    mockNewKeychain.has(server),
  setInternetCredentials: async (server: string, _username: string, password: string) => {
    mockNewKeychain.set(server, password)
    return { service: server }
  },
  resetInternetCredentials: async ({ server }: { server: string }) => {
    mockNewKeychain.delete(server)
  },
}))

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>()
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value)
      },
      multiRemove: async (keys: ReadonlyArray<string>) => {
        keys.forEach((key) => store.delete(key))
      },
      clear: async () => {
        store.clear()
      },
    },
  }
})

const mockClearToken = () => KeyStoreWrapper.removeActiveToken()

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    updateState: () => {},
    resetState: () => {},
    clearToken: () => mockClearToken(),
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: null }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

jest.mock("@app/self-custodial/bridge", () => ({
  disconnectSdk: jest.fn(),
}))

/** The one wallet the device stores, open in the app, so deleting it deletes the last one. */
const mockStoredAccount = { type: "self-custodial", id: "stored-wallet" }

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: [mockStoredAccount],
    activeAccount: mockStoredAccount,
    setActiveAccountId: () => {},
    reloadSelfCustodialAccounts: async () => undefined,
  }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => false,
}))

jest.mock("@app/self-custodial/config", () => ({
  storageDirFor: (id: string) => `/wallets/${id}`,
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  removeBackupStateFor: async () => undefined,
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  deleteRecoveryBundleFile: async () => undefined,
  removeRecoveryBundleState: async () => undefined,
}))

jest.mock("@app/self-custodial/recovery-bundle/refresh", () => ({
  markAccountDeletedForRefresh: () => undefined,
  unmarkAccountDeletedForRefresh: () => undefined,
  waitForRefreshesToSettle: async () => undefined,
}))

jest.mock("react-native-fs", () => ({
  unlink: async () => undefined,
}))

jest.mock("@app/graphql/generated", () => ({
  useUserLogoutMutation: () => [jest.fn()],
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: jest.fn(),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: async () => "",
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: jest.fn(),
}))

const WALLET_ID = "stored-wallet"
const SEED = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"
const PIN = "1234"
const SEED_KEY = `mnemonic:${WALLET_ID}`

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os })
}

const removeStoredWallets = () => {
  const { result } = renderHook(() => useRemoveStoredWallets())
  return result.current()
}

const logout = () => {
  const { result } = renderHook(() => useLogout())
  return result.current.logout()
}

const deleteLastWallet = async () => {
  const { result } = renderHook(() => useDeleteAccount())
  let outcome: Awaited<ReturnType<typeof result.current.deleteWallet>>
  await act(async () => {
    outcome = await result.current.deleteWallet(WALLET_ID)
  })
  return outcome
}

const listedWalletIds = async (): Promise<ReadonlyArray<string>> => {
  const listed = await listSelfCustodialAccounts()
  if (listed.status === StorageReadStatus.ReadFailed) throw listed.error
  return listed.entries.map(({ id }) => id)
}

const storeWallet = async (id: string) => {
  await KeyStoreWrapper.setMnemonicForAccount(id, SEED)
  await addSelfCustodialAccountId(id)
}

/** A value left by an earlier release, on disk and loaded by this launch. */
const storeLegacyValue = (key: string, value: string) => {
  mockLegacyPrefs.memory.set(key, value)
  mockLegacyPrefs.file.set(key, value)
}

const originalPlatform = Platform.OS

beforeAll(() => {
  setPlatform("android")
})

afterAll(() => {
  setPlatform(originalPlatform)
})

beforeEach(async () => {
  mockLegacyPrefs.memory.clear()
  mockLegacyPrefs.file.clear()
  mockLegacyPrefs.isFileWriteFailing = false
  mockNewKeychain.clear()
  await AsyncStorage.clear()
  await KeyStoreWrapper.setPin(PIN)
})

describe("the forgotten-PIN removal on the Android legacy store", () => {
  it("keeps the wallet listed and the lock set when the seed's removal does not reach disk", async () => {
    await storeWallet(WALLET_ID)
    mockLegacyPrefs.isFileWriteFailing = true

    const result = await removeStoredWallets()

    expect(result).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    expect(await listedWalletIds()).toEqual([WALLET_ID])
    // Undone in memory too, so this process and the next launch read the same seed.
    expect(mockLegacyPrefs.memory.get(SEED_KEY)).toBe(SEED)
    expect(mockLegacyPrefs.file.get(SEED_KEY)).toBe(SEED)
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("removes a stored wallet and the lock with it once the removal reaches disk", async () => {
    await storeWallet(WALLET_ID)

    const result = await removeStoredWallets()

    expect(result).toEqual({ isEveryWalletRemoved: true, isAppLockKept: false })
    expect(await listedWalletIds()).toEqual([])
    expect(mockLegacyPrefs.file.has(SEED_KEY)).toBe(false)
    expect(await KeyStoreWrapper.getPin()).toBeNull()
  })
})

describe("a logout on the Android legacy store", () => {
  it("keeps the lock when the active token's removal does not reach disk", async () => {
    storeLegacyValue(GALOY_AUTH_TOKEN_KEY, "bearer-token")
    mockLegacyPrefs.isFileWriteFailing = true

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(true)
    expect(mockLegacyPrefs.file.get(GALOY_AUTH_TOKEN_KEY)).toBe("bearer-token")
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("keeps the lock when the saved sessions' removal does not reach disk", async () => {
    storeLegacyValue("sessionProfiles", JSON.stringify([{ token: "saved" }]))
    mockLegacyPrefs.isFileWriteFailing = true

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(true)
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("drops the lock once the token and sessions are gone from disk", async () => {
    storeLegacyValue(GALOY_AUTH_TOKEN_KEY, "bearer-token")
    storeLegacyValue("sessionProfiles", JSON.stringify([{ token: "saved" }]))

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(false)
    expect(await KeyStoreWrapper.getPin()).toBeNull()
    expect([...mockLegacyPrefs.file.keys()]).toEqual([])
  })
})

describe("writes after one the disk refused", () => {
  const SAVED_SESSIONS = JSON.stringify([{ token: "saved" }])
  const SESSIONS_KEY = "sessionProfiles"

  it("still reads the saved sessions a refused logout left in place", async () => {
    storeLegacyValue(SESSIONS_KEY, SAVED_SESSIONS)
    mockLegacyPrefs.isFileWriteFailing = true

    await logout()
    const read = await KeyStoreWrapper.readSessionProfiles()

    expect(mockLegacyPrefs.memory.get(SESSIONS_KEY)).toBe(SAVED_SESSIONS)
    expect(read).toEqual({ status: "found", profiles: [{ token: "saved" }] })
  })

  it("keeps a refused seed erase from landing with the next write that reaches disk", async () => {
    await storeWallet(WALLET_ID)
    mockLegacyPrefs.isFileWriteFailing = true
    const outcome = await deleteLastWallet()
    mockLegacyPrefs.isFileWriteFailing = false

    // Any write that lands saves the whole file, as storing another wallet's seed does.
    await KeyStoreWrapper.setMnemonicForAccount("another-wallet", SEED)

    expect(outcome).toBeUndefined()
    expect(await listedWalletIds()).toEqual([WALLET_ID])
    expect(mockLegacyPrefs.file.get(SEED_KEY)).toBe(SEED)
    expect(await KeyStoreWrapper.getMnemonicForAccount(WALLET_ID)).toBe(SEED)
  })

  it("keeps the wallet and the lock while the disk still fails", async () => {
    storeLegacyValue(SESSIONS_KEY, SAVED_SESSIONS)
    await storeWallet(WALLET_ID)
    mockLegacyPrefs.isFileWriteFailing = true
    await logout()

    const outcome = await deleteLastWallet()

    expect(outcome).toBeUndefined()
    expect(await listedWalletIds()).toEqual([WALLET_ID])
    expect(mockLegacyPrefs.file.get(SESSIONS_KEY)).toBe(SAVED_SESSIONS)
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("keeps the lock on the last wallet's deletion once the disk is back, since the sessions are still saved", async () => {
    storeLegacyValue(SESSIONS_KEY, SAVED_SESSIONS)
    await storeWallet(WALLET_ID)
    mockLegacyPrefs.isFileWriteFailing = true
    await logout()
    mockLegacyPrefs.isFileWriteFailing = false

    const outcome = await deleteLastWallet()

    expect(outcome).toBe("logged-out-locked")
    expect(await listedWalletIds()).toEqual([])
    // The deletion's read moved them to the new store, where they still are.
    expect(await KeyStoreWrapper.readSessionProfiles()).toEqual({
      status: "found",
      profiles: [{ token: "saved" }],
    })
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })
})

describe("the PIN lock repair after a seed erase the disk refused", () => {
  const DAY_MS = 24 * 60 * 60 * 1000

  it("keeps the seed when the repair's erase of the legacy count is the next write to land", async () => {
    await storeWallet(WALLET_ID)
    // An upgraded install whose launch read a legacy count, so the next write to the PIN
    // state still erases it from the legacy store.
    storeLegacyValue("pinAttempts", "1")
    await KeyStoreWrapper.getPinFailureState()
    // A lock further out than one failure warrants, as a clock corrected backward leaves it.
    const now = Date.now()
    mockNewKeychain.set(
      serverFor("pinFailureState"),
      JSON.stringify({ attempts: 1, lockedUntil: now + DAY_MS }),
    )
    mockLegacyPrefs.isFileWriteFailing = true
    const outcome = await deleteLastWallet()
    mockLegacyPrefs.isFileWriteFailing = false

    const lock = await readPinLockState(now)

    expect(outcome).toBeUndefined()
    expect(lock).toEqual({
      status: "readable",
      state: { attempts: 1, lockedUntil: now + 10_000 },
    })
    // The repair's legacy erase reached disk, and the seed's refused erase did not go with it.
    expect(mockLegacyPrefs.file.has("pinAttempts")).toBe(false)
    expect(mockLegacyPrefs.file.get(SEED_KEY)).toBe(SEED)
    expect(await listedWalletIds()).toEqual([WALLET_ID])
  })
})
