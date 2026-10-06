import React from "react"
import { Platform, Text, TouchableOpacity } from "react-native"

import { Network } from "@breeztech/breez-sdk-spark-react-native"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"
import {
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge/lifecycle"
import { sweepMnemonicMigration } from "@app/self-custodial/storage/account-index"
import { PersistentStateProvider } from "@app/store/persistent-state"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * The three stores of a device, held in memory and read by the real storage
 * code. A reinstall empties the first and leaves the other two, which is the
 * whole reason the wipe under test exists.
 */
const mockAsyncStorage = new Map<string, string>()
const mockKeychain = new Map<string, string>()
const mockLegacyStore = new Map<string, string>()

const mockFaults = {
  indexReads: false,
  trackedListReads: false,
  trackedListWrites: false,
}

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      const isFailingIndexRead =
        mockFaults.indexReads && key.startsWith("selfCustodialAccount")
      if (isFailingIndexRead) throw new Error("AsyncStorage unavailable")
      return mockAsyncStorage.get(key) ?? null
    },
    setItem: async (key: string, value: string) => {
      mockAsyncStorage.set(key, value)
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => mockAsyncStorage.delete(key))
    },
    getAllKeys: async () => [...mockAsyncStorage.keys()],
  },
}))

jest.mock("react-native-keychain", () => ({
  __esModule: true,
  getInternetCredentials: async (server: string) => {
    const isFailingListRead =
      mockFaults.trackedListReads && server.endsWith("/mnemonicAccounts")
    if (isFailingListRead) throw new Error("keychain unavailable")
    const password = mockKeychain.get(server)
    return password === undefined ? false : { username: server, password }
  },
  hasInternetCredentials: async ({ server }: { server: string }) =>
    mockKeychain.has(server),
  setInternetCredentials: async (server: string, _username: string, password: string) => {
    const isFailingListWrite =
      mockFaults.trackedListWrites && server.endsWith("/mnemonicAccounts")
    if (isFailingListWrite) return false
    mockKeychain.set(server, password)
    return { service: server }
  },
  resetInternetCredentials: async ({ server }: { server: string }) => {
    mockKeychain.delete(server)
  },
  resetGenericPassword: async ({ service }: { service: string }) => {
    if (service === "RNSecureKeyStoreKeyChain") mockLegacyStore.clear()
    return true
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly",
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly",
  },
}))

jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: async (key: string) => {
      const value = mockLegacyStore.get(key)
      if (value === undefined) {
        throw Object.assign(new Error("key does not present"), { code: "404" })
      }
      return value
    },
    remove: async (key: string) => {
      if (!mockLegacyStore.delete(key)) {
        throw Object.assign(new Error("could not delete"), { code: "6" })
      }
    },
    setResetOnAppUninstallTo: () => {},
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
}))

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: async () => {},
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: async () => "",
}))

jest.mock("@app/utils/analytics", () => ({ logLogout: jest.fn() }))

jest.mock("@app/graphql/generated", () => ({
  useUserLogoutMutation: () => [jest.fn()],
}))

jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

jest.mock("react-native-fs", () => ({ DocumentDirectoryPath: "/test/documents" }))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn() },
  MaxFee: { NetworkRecommended: jest.fn() },
  defaultConfig: () => ({}),
  initLogging: jest.fn(),
  connect: async () => ({ disconnect: async () => {} }),
}))

jest.mock("bip39", () => ({
  generateMnemonic: () => "new wallet fixture words",
  validateMnemonic: () => true,
}))

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size),
}))

jest.mock("@app/self-custodial/logging", () => ({ createSdkLogListener: jest.fn() }))

jest.mock("@app/self-custodial/lnurl-server-mode", () => ({
  recoverLnurlServerMode: async () => null,
}))

const BLOB_KEY = "persistentState"
const INDEX_KEY = "selfCustodialAccountIndex"

const PREVIOUS_OWNER = "previous-owner-account"
const PREVIOUS_OWNER_WORDS = "previous owner fixture words"
const UPGRADED_ACCOUNT = "upgraded-account"
const UPGRADED_WORDS = "upgraded account fixture words"
const NEW_WALLET = "new-wallet-account"
const NEW_WALLET_WORDS = "new wallet fixture words"

const serverFor = (slot: string) => `secure-store.blink.local/${slot}`

const deviceSecrets = () => [...mockKeychain.keys(), ...mockLegacyStore.keys()]

const isWipeOwed = (): boolean => {
  const blob = mockAsyncStorage.get(BLOB_KEY)
  if (blob === undefined) return false
  return JSON.parse(blob).pendingReinstallKeyMaterialWipe === true
}

/** A device handed over with the previous owner's wallet still in its keychain. */
const reinstallOverPreviousOwner = () => {
  mockKeychain.set(serverFor(`mnemonic:${PREVIOUS_OWNER}`), PREVIOUS_OWNER_WORDS)
  mockKeychain.set(serverFor("mnemonicAccounts"), PREVIOUS_OWNER)
  mockLegacyStore.set(`mnemonic:${PREVIOUS_OWNER}`, PREVIOUS_OWNER_WORDS)
}

/** An install that predates the keychain move: its wallet is in the legacy store only. */
const upgradeWithLegacyWallet = () => {
  const { galoyAuthToken: _token, ...blob } = defaultPersistentState
  mockAsyncStorage.set(BLOB_KEY, JSON.stringify(blob))
  mockAsyncStorage.set(
    INDEX_KEY,
    JSON.stringify([{ id: UPGRADED_ACCOUNT, lightningAddress: null }]),
  )
  mockLegacyStore.set(`mnemonic:${UPGRADED_ACCOUNT}`, UPGRADED_WORDS)
  mockLegacyStore.set(`mnemonic_network:${UPGRADED_ACCOUNT}`, "mainnet")
}

const uninstallAndReinstall = () => mockAsyncStorage.clear()

const App: React.FC = () => {
  const { logout } = useLogout()
  const [isSignedOut, setIsSignedOut] = React.useState(false)

  const expireSession = async () => {
    await logout({ preserveStoredCredentials: true })
    setIsSignedOut(true)
  }

  return (
    <>
      <Text testID="booted">booted</Text>
      {isSignedOut && <Text testID="signed-out">signed out</Text>}
      <TouchableOpacity testID="expire-session" onPress={expireSession} />
    </>
  )
}

/**
 * The first render loads React Native's components on demand, which on a cold
 * transform cache outlasts the default wait before it is ever polled.
 */
const BOOT_TIMEOUT_MS = 10_000

/** Every fake resolves on a microtask, so one macrotask lets each queued save land. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })

const boot = async () => {
  const view = render(
    <PersistentStateProvider>
      <App />
    </PersistentStateProvider>,
  )
  await waitFor(
    () => {
      expect(screen.getByTestId("booted")).toBeTruthy()
    },
    { timeout: BOOT_TIMEOUT_MS },
  )
  await settle()
  return view
}

const ORIGINAL_PLATFORM = Platform.OS

beforeAll(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
})

afterAll(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: ORIGINAL_PLATFORM })
})

beforeEach(() => {
  mockAsyncStorage.clear()
  mockKeychain.clear()
  mockLegacyStore.clear()
  mockFaults.indexReads = false
  mockFaults.trackedListReads = false
  mockFaults.trackedListWrites = false
  // The app is closed before the idle sweep in every journey here, so nothing
  // but the code under test gets to record an account.
  jest.spyOn(global, "requestIdleCallback").mockImplementation(() => 0)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("an owed reinstall wipe", () => {
  it("outlives an expired-session logout and erases the previous owner's wallet on the next boot", async () => {
    reinstallOverPreviousOwner()
    mockFaults.trackedListReads = true
    const reinstallBoot = await boot()
    expect(isWipeOwed()).toBe(true)
    mockFaults.trackedListReads = false

    fireEvent.press(screen.getByTestId("expire-session"))
    await waitFor(() => {
      expect(screen.getByTestId("signed-out")).toBeTruthy()
    })
    await settle()

    expect(isWipeOwed()).toBe(true)
    expect(mockKeychain.get(serverFor(`mnemonic:${PREVIOUS_OWNER}`))).toBe(
      PREVIOUS_OWNER_WORDS,
    )

    reinstallBoot.unmount()
    await boot()

    expect(deviceSecrets()).toEqual([])
    expect(isWipeOwed()).toBe(false)
  })

  it("finds no wallet to take when a registration could not read the index", async () => {
    reinstallOverPreviousOwner()
    mockFaults.indexReads = true
    const reinstallBoot = await boot()
    expect(isWipeOwed()).toBe(true)

    await expect(selfCustodialCreateWallet(NEW_WALLET, Network.Regtest)).rejects.toThrow(
      "AsyncStorage unavailable",
    )
    expect(mockKeychain.has(serverFor(`mnemonic:${NEW_WALLET}`))).toBe(false)
    expect(mockKeychain.get(serverFor("mnemonicAccounts"))).toBe(PREVIOUS_OWNER)

    mockFaults.indexReads = false
    reinstallBoot.unmount()
    await boot()

    expect(deviceSecrets()).toEqual([])
    expect(isWipeOwed()).toBe(false)
  })

  it("finds nothing of a restored wallet whose registration could not read the index", async () => {
    reinstallOverPreviousOwner()
    mockFaults.indexReads = true
    const reinstallBoot = await boot()

    await expect(
      selfCustodialRestoreWallet({
        accountId: NEW_WALLET,
        mnemonic: NEW_WALLET_WORDS,
        network: Network.Regtest,
        leewaySatPerVbyte: 1,
      }),
    ).rejects.toThrow("AsyncStorage unavailable")
    expect(mockKeychain.has(serverFor(`mnemonic:${NEW_WALLET}`))).toBe(false)

    mockFaults.indexReads = false
    reinstallBoot.unmount()
    await boot()

    expect(deviceSecrets()).toEqual([])
    expect(isWipeOwed()).toBe(false)
  })

  it("leaves alone the wallet that registered on a second attempt", async () => {
    reinstallOverPreviousOwner()
    mockFaults.indexReads = true
    const reinstallBoot = await boot()

    await expect(selfCustodialCreateWallet(NEW_WALLET, Network.Regtest)).rejects.toThrow()
    mockFaults.indexReads = false
    await selfCustodialCreateWallet(NEW_WALLET, Network.Regtest)

    reinstallBoot.unmount()
    await boot()

    expect(await KeyStoreWrapper.getMnemonicForAccount(NEW_WALLET)).toBe(NEW_WALLET_WORDS)
    expect(isWipeOwed()).toBe(false)
  })
})

describe("a mnemonic that a read migrated", () => {
  it("is erased by the next reinstall, with no sweep in between", async () => {
    upgradeWithLegacyWallet()
    const upgradeBoot = await boot()

    expect(await KeyStoreWrapper.getMnemonicForAccount(UPGRADED_ACCOUNT)).toBe(
      UPGRADED_WORDS,
    )
    expect(await KeyStoreWrapper.getMnemonicNetworkForAccount(UPGRADED_ACCOUNT)).toBe(
      "mainnet",
    )
    expect(mockKeychain.get(serverFor(`mnemonic:${UPGRADED_ACCOUNT}`))).toBe(
      UPGRADED_WORDS,
    )

    upgradeBoot.unmount()
    uninstallAndReinstall()
    await boot()

    expect(deviceSecrets()).toEqual([])
    expect(isWipeOwed()).toBe(false)
  })

  it("is recorded by the next sweep when the read could not record it, and erased after", async () => {
    upgradeWithLegacyWallet()
    mockFaults.trackedListWrites = true
    const upgradeBoot = await boot()

    expect(await KeyStoreWrapper.getMnemonicForAccount(UPGRADED_ACCOUNT)).toBe(
      UPGRADED_WORDS,
    )
    expect([...mockKeychain.keys()]).toEqual([serverFor(`mnemonic:${UPGRADED_ACCOUNT}`)])

    mockFaults.trackedListWrites = false
    expect(await sweepMnemonicMigration()).toEqual({ status: "ok", migrated: 1 })
    expect(mockKeychain.get(serverFor("mnemonicAccounts"))).toBe(UPGRADED_ACCOUNT)

    upgradeBoot.unmount()
    uninstallAndReinstall()
    await boot()

    expect(deviceSecrets()).toEqual([])
  })
})
