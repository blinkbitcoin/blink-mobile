import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  defaultRecoveryBundleSettings,
  readRecoveryBundleSettings,
  removeRecoveryBundleSettings,
  writeRecoveryBundleSettings,
} from "@app/self-custodial/recovery-bundle/settings"

// In-memory AsyncStorage so the per-account keys are exercised through real
// read-after-write behavior instead of per-call stubs (same pattern as
// storage.spec.ts).
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

const ACCOUNT_ID = "acct-1"
const OTHER_ACCOUNT_ID = "acct-2"

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe("recovery bundle settings", () => {
  it("defaults to automatic refresh on and cloud sync off", async () => {
    const settings = await readRecoveryBundleSettings(ACCOUNT_ID)

    // These defaults are product rules (PRD 4.1): refresh is opt-out, cloud
    // sync is opt-in. Flipping either default is a product decision.
    expect(settings).toEqual({ autoRefresh: true, cloudSync: false })
    expect(defaultRecoveryBundleSettings).toEqual({
      autoRefresh: true,
      cloudSync: false,
    })
  })

  it("round-trips written settings per account", async () => {
    await writeRecoveryBundleSettings(ACCOUNT_ID, {
      autoRefresh: false,
      cloudSync: true,
    })

    expect(await readRecoveryBundleSettings(ACCOUNT_ID)).toEqual({
      autoRefresh: false,
      cloudSync: true,
    })
    // Another account keeps the defaults.
    expect(await readRecoveryBundleSettings(OTHER_ACCOUNT_ID)).toEqual(
      defaultRecoveryBundleSettings,
    )
  })

  it("degrades corrupted stored data to the defaults", async () => {
    await AsyncStorage.setItem(`recoveryBundleSettings:${ACCOUNT_ID}`, "not-json{")

    expect(await readRecoveryBundleSettings(ACCOUNT_ID)).toEqual(
      defaultRecoveryBundleSettings,
    )
  })

  it("fills missing or mistyped fields with the defaults", async () => {
    await AsyncStorage.setItem(
      `recoveryBundleSettings:${ACCOUNT_ID}`,
      JSON.stringify({ cloudSync: "yes" }),
    )

    expect(await readRecoveryBundleSettings(ACCOUNT_ID)).toEqual(
      defaultRecoveryBundleSettings,
    )
  })

  it("remove resets the account to the defaults", async () => {
    await writeRecoveryBundleSettings(ACCOUNT_ID, {
      autoRefresh: false,
      cloudSync: true,
    })
    await removeRecoveryBundleSettings(ACCOUNT_ID)

    expect(await readRecoveryBundleSettings(ACCOUNT_ID)).toEqual(
      defaultRecoveryBundleSettings,
    )
  })
})
