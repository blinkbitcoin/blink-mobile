import { renderHook } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

import useLogout from "@app/hooks/use-logout"
import { useRemoveStoredWallets } from "@app/self-custodial/hooks/use-remove-stored-wallets"
import {
  addSelfCustodialAccountId,
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import KeyStoreWrapper, { GALOY_AUTH_TOKEN_KEY } from "@app/utils/storage/secureStorage"

/**
 * The legacy keychain as iOS answers it, under the real storage stack and the two ways out
 * that drop the app lock: a logout, and the forgotten-PIN removal of every stored wallet.
 * Each of those has its own spec that stubs what storage answers; this one pins what the
 * native answers compose into. Only the two keychains are faked.
 *
 * The iOS module loses the OSStatus on the way out (ios/RNSecureKeyStore.m): `remove:`
 * rejects with "6" and `get:` with "404" whatever went wrong, so a keychain that will not
 * answer for an item looks to both exactly like one that does not hold it. Only `set:`
 * refuses for the fault alone.
 */

type LegacyKeychain = {
  readonly items: Map<string, string>
  /** The items are there but the keychain will not answer for them, as before first unlock. */
  isFailing: boolean
}

const mockLegacyKeychain: LegacyKeychain = { items: new Map(), isFailing: false }

/** The new store answers truthfully on iOS, so it is kept healthy: a fault there already
 *  fails closed, and only the legacy store's answers are under test. */
const mockNewKeychain = new Map<string, string>()

const mockNativeRejection = (code: string, message: string) =>
  Object.assign(new Error(message), { code })

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: async (key: string) => {
      const value = mockLegacyKeychain.items.get(key)
      const isUnanswered = mockLegacyKeychain.isFailing || value === undefined
      if (isUnanswered) throw mockNativeRejection("404", "key does not present")
      return value
    },
    set: async (key: string, value: string, options?: object) => {
      // A call without its options crashes the app on iOS; a rejection here keeps that loud.
      if (options === undefined) throw new Error("set: called without its options")
      if (mockLegacyKeychain.isFailing) throw mockNativeRejection("9", "error saving key")
      mockLegacyKeychain.items.set(key, value)
      return "key stored successfully"
    },
    remove: async (key: string) => {
      const isUnanswered =
        mockLegacyKeychain.isFailing || !mockLegacyKeychain.items.has(key)
      if (isUnanswered) throw mockNativeRejection("6", "could not delete key")
      mockLegacyKeychain.items.delete(key)
      return "key removed successfully"
    },
    setResetOnAppUninstallTo: () => true,
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

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

/** In memory, so the wallet index is read back after every write the way the device has it. */
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

/** The provider's own removal retries once and keeps its dirty-check ref in step; both are
 *  covered where it lives. What it answers with is this erase's answer. */
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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ reloadSelfCustodialAccounts: async () => undefined }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => false,
}))

/** Everything a wallet's erase does besides the seed and its index entry is covered where
 *  it lives, and none of it decides what the lock does. */
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

const removeStoredWallets = () => {
  const { result } = renderHook(() => useRemoveStoredWallets())
  return result.current()
}

const logout = () => {
  const { result } = renderHook(() => useLogout())
  return result.current.logout()
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

beforeEach(async () => {
  mockLegacyKeychain.items.clear()
  mockLegacyKeychain.isFailing = false
  mockNewKeychain.clear()
  await AsyncStorage.clear()
  await KeyStoreWrapper.setPin(PIN)
})

describe("the forgotten-PIN removal on the iOS legacy keychain", () => {
  it("keeps the wallet listed and the lock set while the keychain will not give the seed up", async () => {
    await storeWallet(WALLET_ID)
    mockLegacyKeychain.isFailing = true

    const result = await removeStoredWallets()

    expect(result).toEqual({ isEveryWalletRemoved: false, isAppLockKept: true })
    expect(await listedWalletIds()).toEqual([WALLET_ID])
    expect(mockLegacyKeychain.items.get(`mnemonic:${WALLET_ID}`)).toBe(SEED)
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("finishes a removal whose seed an earlier run already erased", async () => {
    // Listed with no seed behind it: the state a run cut short right after the seed leaves.
    await addSelfCustodialAccountId(WALLET_ID)

    const result = await removeStoredWallets()

    expect(result).toEqual({ isEveryWalletRemoved: true, isAppLockKept: false })
    expect(await listedWalletIds()).toEqual([])
    expect(await KeyStoreWrapper.getPin()).toBeNull()
    // The blanks that proved each missing key gone were tidied away behind themselves.
    expect([...mockLegacyKeychain.items.keys()]).toEqual([])
  })

  it("removes a stored wallet and the lock with it on a keychain that answers", async () => {
    await storeWallet(WALLET_ID)

    const result = await removeStoredWallets()

    expect(result).toEqual({ isEveryWalletRemoved: true, isAppLockKept: false })
    expect(await listedWalletIds()).toEqual([])
    expect(mockLegacyKeychain.items.has(`mnemonic:${WALLET_ID}`)).toBe(false)
  })
})

describe("a logout on the iOS legacy keychain", () => {
  it("keeps the lock while the keychain will not give the active token up", async () => {
    mockLegacyKeychain.items.set(GALOY_AUTH_TOKEN_KEY, "bearer-token")
    mockLegacyKeychain.isFailing = true

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(true)
    expect(mockLegacyKeychain.items.get(GALOY_AUTH_TOKEN_KEY)).toBe("bearer-token")
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("keeps the lock while the keychain will not give the saved sessions up", async () => {
    mockLegacyKeychain.items.set("sessionProfiles", JSON.stringify([{ token: "saved" }]))
    mockLegacyKeychain.isFailing = true

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(true)
    expect(await KeyStoreWrapper.getPin()).toBe(PIN)
  })

  it("drops the lock once the token and sessions are gone from a keychain that answers", async () => {
    mockLegacyKeychain.items.set(GALOY_AUTH_TOKEN_KEY, "bearer-token")
    mockLegacyKeychain.items.set("sessionProfiles", JSON.stringify([{ token: "saved" }]))

    const { isAppLockKept } = await logout()

    expect(isAppLockKept).toBe(false)
    expect(await KeyStoreWrapper.getPin()).toBeNull()
    expect([...mockLegacyKeychain.items.keys()]).toEqual([])
  })
})
