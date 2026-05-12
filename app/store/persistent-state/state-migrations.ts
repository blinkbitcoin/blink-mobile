import { GALOY_INSTANCES, GaloyInstance, GaloyInstanceInput } from "@app/config"
import { DefaultAccountId } from "@app/types/wallet"

type PersistentState_3 = {
  schemaVersion: 3
  hasShownStableSatsWelcome: boolean
  isUsdDisabled: boolean
  galoyInstance: GaloyInstance
  galoyAuthToken: string
  isAnalyticsEnabled: boolean
}

type PersistentState_4 = {
  schemaVersion: 4
  hasShownStableSatsWelcome: boolean
  isUsdDisabled: boolean
  galoyInstance: GaloyInstance
  galoyAuthToken: string
  isAnalyticsEnabled: boolean
}

type PersistentState_5 = {
  schemaVersion: 5
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
}

type PersistentState_6 = {
  schemaVersion: 6
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
}

type PersistentState_7 = {
  schemaVersion: 7
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
}

type PersistentState_8 = {
  schemaVersion: 8
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
}

type PersistentState_9 = {
  schemaVersion: 9
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
}

type PersistentState_10 = {
  schemaVersion: 10
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  // Legacy fallback for pre-schema-10 users; new writes go to the per-account map.
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
}

type PersistentState_11 = {
  schemaVersion: 11
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
}

const migrate11ToCurrent = (state: PersistentState_11): Promise<PersistentState> =>
  Promise.resolve(state)

const migrateLegacyDefaultCurrencyToActiveAccount = (
  state: PersistentState_10,
): PersistentState_10 => {
  const { selfCustodialDefaultWalletCurrency: legacy, ...withoutLegacy } = state
  if (!legacy) return state

  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return withoutLegacy

  const map = state.selfCustodialDefaultWalletCurrencyByAccountId
  if (map && id in map) return withoutLegacy

  return {
    ...withoutLegacy,
    selfCustodialDefaultWalletCurrencyByAccountId: { ...map, [id]: legacy },
  }
}

const migrate10ToCurrent = (state: PersistentState_10): Promise<PersistentState> =>
  migrate11ToCurrent({
    ...migrateLegacyDefaultCurrencyToActiveAccount(state),
    schemaVersion: 11,
  })

const migrate9ToCurrent = (state: PersistentState_9): Promise<PersistentState> =>
  migrate10ToCurrent({ ...state, schemaVersion: 10 })

const migrate8ToCurrent = (state: PersistentState_8): Promise<PersistentState> =>
  migrate9ToCurrent({ ...state, schemaVersion: 9 })

const migrate7ToCurrent = (state: PersistentState_7): Promise<PersistentState> =>
  migrate8ToCurrent({ ...state, schemaVersion: 8 })

const migrate6ToCurrent = (state: PersistentState_6): Promise<PersistentState> =>
  migrate7ToCurrent({
    ...state,
    schemaVersion: 7,
  })

const migrate5ToCurrent = (state: PersistentState_5): Promise<PersistentState> => {
  return migrate6ToCurrent({
    ...state,
    schemaVersion: 6,
  })
}

const migrate4ToCurrent = (state: PersistentState_4): Promise<PersistentState> => {
  const newGaloyInstance = GALOY_INSTANCES.find(
    (instance) => instance.name === state.galoyInstance.name,
  )

  if (!newGaloyInstance) {
    if (state.galoyInstance.name === "BBW") {
      const newGaloyInstanceTest = GALOY_INSTANCES.find(
        (instance) => instance.name === "Blink",
      )

      if (!newGaloyInstanceTest) {
        throw new Error("Galoy instance not found")
      }
    }
  }

  let galoyInstance: GaloyInstanceInput

  if (state.galoyInstance.name === "Custom") {
    // we only keep the full object if we are on Custom
    // otherwise data will be stored in GaloyInstancesInput[]
    galoyInstance = { ...state.galoyInstance, id: "Custom" }
  } else if (state.galoyInstance.name === "BBW" || state.galoyInstance.name === "Blink") {
    // we are using "Main" instead of "BBW", so that the bankName is not hardcoded in the saved json
    galoyInstance = { id: "Main" } as const
  } else {
    galoyInstance = { id: state.galoyInstance.name as "Staging" | "Local" }
  }

  return migrate5ToCurrent({
    schemaVersion: 5,
    galoyAuthToken: state.galoyAuthToken,
    galoyInstance,
  })
}

const migrate3ToCurrent = (state: PersistentState_3): Promise<PersistentState> => {
  const newGaloyInstance = GALOY_INSTANCES.find(
    (instance) => instance.name === state.galoyInstance.name,
  )

  if (!newGaloyInstance) {
    throw new Error("Galoy instance not found")
  }

  return migrate4ToCurrent({
    ...state,
    galoyInstance: newGaloyInstance,
    schemaVersion: 4,
  })
}

type StateMigrations = {
  3: (state: PersistentState_3) => Promise<PersistentState>
  4: (state: PersistentState_4) => Promise<PersistentState>
  5: (state: PersistentState_5) => Promise<PersistentState>
  6: (state: PersistentState_6) => Promise<PersistentState>
  7: (state: PersistentState_7) => Promise<PersistentState>
  8: (state: PersistentState_8) => Promise<PersistentState>
  9: (state: PersistentState_9) => Promise<PersistentState>
  10: (state: PersistentState_10) => Promise<PersistentState>
  11: (state: PersistentState_11) => Promise<PersistentState>
}

const stateMigrations: StateMigrations = {
  3: migrate3ToCurrent,
  4: migrate4ToCurrent,
  5: migrate5ToCurrent,
  6: migrate6ToCurrent,
  7: migrate7ToCurrent,
  8: migrate8ToCurrent,
  9: migrate9ToCurrent,
  10: migrate10ToCurrent,
  11: migrate11ToCurrent,
}

export type PersistentState = PersistentState_11

export const defaultPersistentState: PersistentState = {
  schemaVersion: 11,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

export const MigrationStatus = {
  Ok: "ok",
  NoData: "no-data",
  Failed: "failed",
} as const

export type MigrationStatus = (typeof MigrationStatus)[keyof typeof MigrationStatus]

export type MigrationResult =
  | { status: typeof MigrationStatus.Ok; state: PersistentState }
  | { status: typeof MigrationStatus.NoData }
  | { status: typeof MigrationStatus.Failed; error: Error; rawData: unknown }

export const migratePersistentState = async (
  // TODO: pass the correct type.
  // this is especially important given this is migration code and it's hard to test manually
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<MigrationResult> => {
  if (!data || !(data.schemaVersion in stateMigrations)) {
    return { status: MigrationStatus.NoData }
  }
  const schemaVersion: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 = data.schemaVersion
  try {
    const migration = stateMigrations[schemaVersion]
    const state = await migration(data)
    return { status: MigrationStatus.Ok, state }
  } catch (err) {
    return {
      status: MigrationStatus.Failed,
      error: err instanceof Error ? err : new Error(String(err)),
      rawData: data,
    }
  }
}
