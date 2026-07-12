import { it } from "@jest/globals"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  readRecoveryBundleState,
  recoveryBundleDirFor,
  recoveryBundlePathFor,
  removeRecoveryBundleState,
  writeRecoveryBundleState,
  type RecoveryBundleState,
} from "@app/self-custodial/recovery-bundle/storage"

// In-memory AsyncStorage so the network-scoped keys are exercised through
// real read-after-write behavior instead of per-call stubs.
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>()
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: async (key: string) => {
        store.delete(key)
      },
      clear: async () => {
        store.clear()
      },
    },
  }
})

jest.mock("react-native-fs", () => ({
  DocumentDirectoryPath: "/test/documents",
}))

const ACCOUNT_ID = "acct-1"
const MAINNET_STATE_KEY = `recoveryBundleState:mainnet:${ACCOUNT_ID}`
const REGTEST_STATE_KEY = `recoveryBundleState:regtest:${ACCOUNT_ID}`

const makeState = (
  overrides: Partial<Record<keyof RecoveryBundleState, unknown>> = {},
): RecoveryBundleState =>
  ({
    savedAt: 1_752_300_000_000,
    bundleCreatedAt: "2026-07-12T00:00:00.000Z",
    leafCount: 3,
    totalSats: "32768",
    cloudSyncedAt: null,
    ...overrides,
  }) as RecoveryBundleState

describe("recovery-bundle storage", () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  describe("refresh/sync state keying", () => {
    it("keys the state by network so a mainnet write is invisible on regtest", async () => {
      const state = makeState()
      await writeRecoveryBundleState(ACCOUNT_ID, Network.Mainnet, state)

      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Regtest)).toBeNull()
      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Mainnet)).toEqual(state)
    })

    it("persists under the stable per-network key format", async () => {
      await writeRecoveryBundleState(ACCOUNT_ID, Network.Mainnet, makeState())

      expect(await AsyncStorage.getItem(MAINNET_STATE_KEY)).toBe(
        JSON.stringify(makeState()),
      )
    })

    it("removes only the addressed network's state", async () => {
      await writeRecoveryBundleState(ACCOUNT_ID, Network.Mainnet, makeState())
      await writeRecoveryBundleState(ACCOUNT_ID, Network.Regtest, makeState())

      await removeRecoveryBundleState(ACCOUNT_ID, Network.Regtest)

      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Regtest)).toBeNull()
      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Mainnet)).toEqual(
        makeState(),
      )
      expect(await AsyncStorage.getItem(REGTEST_STATE_KEY)).toBeNull()
    })
  })

  describe("readRecoveryBundleState validation", () => {
    it("returns null when nothing is stored", async () => {
      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Mainnet)).toBeNull()
    })

    it("returns null for corrupt JSON", async () => {
      await AsyncStorage.setItem(MAINNET_STATE_KEY, "{not json")

      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Mainnet)).toBeNull()
    })

    it.each([
      { name: "missing savedAt", overrides: { savedAt: undefined } },
      { name: "string savedAt", overrides: { savedAt: "1752300000000" } },
      { name: "missing leafCount", overrides: { leafCount: undefined } },
      { name: "string leafCount", overrides: { leafCount: "3" } },
      { name: "missing totalSats", overrides: { totalSats: undefined } },
      { name: "numeric totalSats", overrides: { totalSats: 32768 } },
    ])("returns null for a stored state with $name", async ({ overrides }) => {
      // JSON.stringify drops undefined values, so "missing" cases persist
      // without the field at all.
      await AsyncStorage.setItem(MAINNET_STATE_KEY, JSON.stringify(makeState(overrides)))

      expect(await readRecoveryBundleState(ACCOUNT_ID, Network.Mainnet)).toBeNull()
    })
  })

  describe("bundle file paths", () => {
    it("separates the bundle directories per network", () => {
      expect(recoveryBundleDirFor(Network.Mainnet)).toBe(
        "/test/documents/recovery-bundle-mainnet",
      )
      expect(recoveryBundleDirFor(Network.Regtest)).toBe(
        "/test/documents/recovery-bundle-regtest",
      )
    })

    it("places the same account's bundle in different files per network", () => {
      expect(recoveryBundlePathFor(ACCOUNT_ID, Network.Mainnet)).toBe(
        "/test/documents/recovery-bundle-mainnet/acct-1.json",
      )
      expect(recoveryBundlePathFor(ACCOUNT_ID, Network.Regtest)).toBe(
        "/test/documents/recovery-bundle-regtest/acct-1.json",
      )
    })
  })
})
