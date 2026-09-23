import { it } from "@jest/globals"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  deleteRecoveryBundleFile,
  loadEncryptedBundleFile,
  readRecoveryBundleState,
  recoveryBundleDirFor,
  recoveryBundlePathFor,
  removeRecoveryBundleState,
  saveEncryptedBundleFile,
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

// In-memory filesystem with iOS moveFile semantics (refuses to overwrite) so
// the atomic write-then-rename path actually executes instead of being
// stubbed away.
type FsMockState = {
  files: Map<string, string>
  mkdirCalls: Array<{ path: string; options?: Record<string, unknown> }>
  failNextWriteFor: string | null
}

jest.mock("react-native-fs", () => {
  const state: FsMockState = {
    files: new Map<string, string>(),
    mkdirCalls: [],
    failNextWriteFor: null,
  }
  return {
    __esModule: true,
    __fsState: state,
    DocumentDirectoryPath: "/test/documents",
    default: {
      mkdir: async (path: string, options?: Record<string, unknown>) => {
        state.mkdirCalls.push({ path, options })
      },
      writeFile: async (path: string, contents: string) => {
        if (state.failNextWriteFor === path) {
          state.failNextWriteFor = null
          throw new Error(`ENOSPC: simulated write failure for ${path}`)
        }
        state.files.set(path, contents)
      },
      readFile: async (path: string) => {
        const contents = state.files.get(path)
        if (contents === undefined) throw new Error(`ENOENT: ${path}`)
        return contents
      },
      exists: async (path: string) => state.files.has(path),
      unlink: async (path: string) => {
        if (!state.files.delete(path)) throw new Error(`ENOENT: ${path}`)
      },
      moveFile: async (from: string, to: string) => {
        const contents = state.files.get(from)
        if (contents === undefined) throw new Error(`ENOENT: ${from}`)
        if (state.files.has(to)) throw new Error(`EEXIST: ${to}`)
        state.files.set(to, contents)
        state.files.delete(from)
      },
    },
  }
})

const fsState = (jest.requireMock("react-native-fs") as { __fsState: FsMockState })
  .__fsState

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
    fsState.files.clear()
    fsState.mkdirCalls.length = 0
    fsState.failNextWriteFor = null
  })

  describe("encrypted bundle file", () => {
    const MAINNET_PATH = "/test/documents/recovery-bundle-mainnet/acct-1.json"
    const MAINNET_TMP_PATH = `${MAINNET_PATH}.tmp`

    it("round-trips save and load", async () => {
      await saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-1")

      expect(await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)).toBe("payload-1")
      expect(fsState.files.get(MAINNET_PATH)).toBe("payload-1")
      // The rename completed: no tmp file left behind.
      expect(fsState.files.has(MAINNET_TMP_PATH)).toBe(false)
    })

    it("excludes the bundle directory from iOS device backups", async () => {
      // D9 adjacency: an iOS device backup would put the seed-decryptable
      // bundle in the same Apple account as a passwordless iCloud seed backup.
      await saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-1")

      expect(fsState.mkdirCalls).toEqual([
        {
          path: "/test/documents/recovery-bundle-mainnet",
          options: { NSURLIsExcludedFromBackupKey: true },
        },
      ])
    })

    it("keeps the previous bundle intact when the new write fails", async () => {
      await saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-old")

      fsState.failNextWriteFor = MAINNET_TMP_PATH
      await expect(
        saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-new"),
      ).rejects.toThrow(/ENOSPC/)

      // The interrupted write hit only the tmp sibling; the last good copy
      // is exactly what unilateral exit needs when re-fetching is impossible.
      expect(await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)).toBe(
        "payload-old",
      )
    })

    it("recovers the payload from a stranded tmp file without renaming it", async () => {
      fsState.files.set(MAINNET_TMP_PATH, "payload-from-tmp")

      expect(await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)).toBe(
        "payload-from-tmp",
      )
      // Read in place: a rename here could steal a concurrent save's own
      // rename out of its unlink-to-move window. Repair belongs to save/delete.
      expect(fsState.files.has(MAINNET_PATH)).toBe(false)
      expect(fsState.files.get(MAINNET_TMP_PATH)).toBe("payload-from-tmp")
    })

    it("a save after a stranded-tmp load still lands cleanly and sweeps the tmp", async () => {
      fsState.files.set(MAINNET_TMP_PATH, "payload-from-tmp")
      await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)

      await saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-new")

      expect(await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)).toBe(
        "payload-new",
      )
      expect(fsState.files.has(MAINNET_TMP_PATH)).toBe(false)
    })

    it("returns null when no bundle was ever saved", async () => {
      expect(await loadEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet)).toBeNull()
    })

    it("deletes the bundle file and any stranded tmp sibling", async () => {
      await saveEncryptedBundleFile(ACCOUNT_ID, Network.Mainnet, "payload-1")
      fsState.files.set(MAINNET_TMP_PATH, "stranded")

      await deleteRecoveryBundleFile(ACCOUNT_ID, Network.Mainnet)

      expect(fsState.files.has(MAINNET_PATH)).toBe(false)
      expect(fsState.files.has(MAINNET_TMP_PATH)).toBe(false)
    })

    it("delete is a no-op when nothing exists", async () => {
      await expect(
        deleteRecoveryBundleFile(ACCOUNT_ID, Network.Mainnet),
      ).resolves.toBeUndefined()
    })
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
      { name: "missing bundleCreatedAt", overrides: { bundleCreatedAt: undefined } },
      { name: "numeric bundleCreatedAt", overrides: { bundleCreatedAt: 1752300000000 } },
      { name: "string cloudSyncedAt", overrides: { cloudSyncedAt: "yesterday" } },
      { name: "missing cloudSyncedAt", overrides: { cloudSyncedAt: undefined } },
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
