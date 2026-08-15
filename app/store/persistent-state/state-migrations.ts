import { GALOY_INSTANCES, GaloyInstance, GaloyInstanceInput } from "@app/config"
import { AccountMode } from "@app/types/account"
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

type PersistentState_12 = {
  schemaVersion: 12
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
}

type PersistentState_13 = {
  schemaVersion: 13
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
}

type PersistentState_14 = {
  schemaVersion: 14
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  stablesatsRestrictedCustodial?: boolean
  stableTokenTransferBlocked?: boolean
  stablesatsTransferBlocked?: boolean
  stableTokenRestricted?: boolean
}

type PersistentState_15 = {
  schemaVersion: 15
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  stablesatsRestrictedCustodial?: boolean
  stableTokenTransferBlocked?: boolean
  stablesatsTransferBlocked?: boolean
  stableTokenRestricted?: boolean
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
}

type PersistentState_16 = {
  schemaVersion: 16
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  stablesatsRestrictedCustodial?: boolean
  stableTokenTransferBlocked?: boolean
  stablesatsTransferBlocked?: boolean
  stableTokenRestricted?: boolean
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
  // "Always hide balance" setting. It used to live on the Apollo cache, which only
  // restores when an auth token is present and is purged on logout, so the setting
  // silently reset for self-custodial users.
  alwaysHideBalance?: boolean
  // The visibility the user last left the app in, consulted only when alwaysHideBalance
  // is off. Device-wide, not per-account: hiding is about who can see the screen.
  balanceHidden?: boolean
}

type PersistentState_17 = {
  schemaVersion: 17
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
  // "Always hide balance" setting. It used to live on the Apollo cache, which only
  // restores when an auth token is present and is purged on logout, so the setting
  // silently reset for self-custodial users.
  alwaysHideBalance?: boolean
  // The visibility the user last left the app in, consulted only when alwaysHideBalance
  // is off. Device-wide, not per-account: hiding is about who can see the screen.
  balanceHidden?: boolean
}

type PersistentState_18 = {
  schemaVersion: 18
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
  // "Always hide balance" setting. It used to live on the Apollo cache, which only
  // restores when an auth token is present and is purged on logout, so the setting
  // silently reset for self-custodial users.
  alwaysHideBalance?: boolean
  // The visibility the user last left the app in, consulted only when alwaysHideBalance
  // is off. Device-wide, not per-account: hiding is about who can see the screen.
  balanceHidden?: boolean
  selfCustodialAccountModeByAccountId?: Record<string, AccountMode>
}

type PersistentState_19 = {
  schemaVersion: 19
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
  // "Always hide balance" setting. It used to live on the Apollo cache, which only
  // restores when an auth token is present and is purged on logout, so the setting
  // silently reset for self-custodial users.
  alwaysHideBalance?: boolean
  // The visibility the user last left the app in, consulted only when alwaysHideBalance
  // is off. Device-wide, not per-account: hiding is about who can see the screen.
  balanceHidden?: boolean
  selfCustodialAccountModeByAccountId?: Record<string, AccountMode>
  // Accounts whose Stable Balance was switched off by Anon Mode, not by the user.
  stableBalanceAnonPausedByAccountId?: Record<string, boolean>
}

type PersistentState_20 = {
  schemaVersion: 20
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
  activeAccountId?: string
  selfCustodialDefaultWalletCurrency?: "BTC" | "USD"
  selfCustodialDefaultWalletCurrencyByAccountId?: Record<string, "BTC" | "USD">
  selfCustodialDisplayCurrencyByAccountId?: Record<string, string>
  selfCustodialLanguageByAccountId?: Record<string, string>
  themeByAccountId?: Record<string, "system" | "light" | "dark">
  defaultAccountModalShownByAccountId?: Record<string, boolean>
  // Quiz progress for accounts the backend keeps no quiz record for (self-custodial).
  completedQuizIdsByAccountId?: Record<string, string[]>
  // "Always hide balance" setting. It used to live on the Apollo cache, which only
  // restores when an auth token is present and is purged on logout, so the setting
  // silently reset for self-custodial users.
  alwaysHideBalance?: boolean
  // The visibility the user last left the app in, consulted only when alwaysHideBalance
  // is off. Device-wide, not per-account: hiding is about who can see the screen.
  balanceHidden?: boolean
  selfCustodialAccountModeByAccountId?: Record<string, AccountMode>
  // Accounts whose Stable Balance was switched off by Anon Mode, not by the user.
  stableBalanceAnonPausedByAccountId?: Record<string, boolean>
  // The mode the LNURL server last confirmed, so a mode is pushed once rather than on
  // every launch: each Enhanced push costs the server a paid country lookup.
  selfCustodialServerAccountModeByAccountId?: Record<string, AccountMode>
}

const migrate20ToCurrent = (state: PersistentState_20): Promise<PersistentState> =>
  Promise.resolve(state)

/** Adds the optional per-account server-confirmed mode. Deliberately not backfilled from
 *  the local mode: an account that chose one before this version has never told the
 *  server, so leaving it empty is what makes the first push happen. */
const migrate19ToCurrent = (state: PersistentState_19): Promise<PersistentState> =>
  migrate20ToCurrent({ ...state, schemaVersion: 20 })

/** Adds the optional per-account Anon pause marker; nothing to backfill. */
const migrate18ToCurrent = (state: PersistentState_18): Promise<PersistentState> =>
  migrate19ToCurrent({ ...state, schemaVersion: 19 })

/** Adds the optional per-account self-custodial region mode; nothing to backfill. */
const migrate17ToCurrent = (state: PersistentState_17): Promise<PersistentState> =>
  migrate18ToCurrent({ ...state, schemaVersion: 18 })

/**
 * Drops the four persisted region latches. A determined restriction must no longer
 * outlive the session that set it, so the fields are discarded rather than carried
 * forward: a user previously latched into a restricted region is re-evaluated live on
 * the next launch, with no action on their part.
 */
const migrate16ToCurrent = (state: PersistentState_16): Promise<PersistentState> => {
  const {
    stablesatsRestrictedCustodial,
    stableTokenTransferBlocked,
    stablesatsTransferBlocked,
    stableTokenRestricted,
    ...withoutLatches
  } = state
  return migrate17ToCurrent({ ...withoutLatches, schemaVersion: 17 })
}

const migrate15ToCurrent = (state: PersistentState_15): Promise<PersistentState> =>
  migrate16ToCurrent({ ...state, schemaVersion: 16 })

const migrate14ToCurrent = (state: PersistentState_14): Promise<PersistentState> =>
  migrate15ToCurrent({ ...state, schemaVersion: 15 })

const migrate13ToCurrent = (state: PersistentState_13): Promise<PersistentState> =>
  migrate14ToCurrent({ ...state, schemaVersion: 14 })

const migrate12ToCurrent = (state: PersistentState_12): Promise<PersistentState> =>
  migrate13ToCurrent({ ...state, schemaVersion: 13 })

const migrate11ToCurrent = (state: PersistentState_11): Promise<PersistentState> =>
  migrate12ToCurrent({ ...state, schemaVersion: 12 })

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
  12: (state: PersistentState_12) => Promise<PersistentState>
  13: (state: PersistentState_13) => Promise<PersistentState>
  14: (state: PersistentState_14) => Promise<PersistentState>
  15: (state: PersistentState_15) => Promise<PersistentState>
  16: (state: PersistentState_16) => Promise<PersistentState>
  17: (state: PersistentState_17) => Promise<PersistentState>
  18: (state: PersistentState_18) => Promise<PersistentState>
  19: (state: PersistentState_19) => Promise<PersistentState>
  20: (state: PersistentState_20) => Promise<PersistentState>
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
  12: migrate12ToCurrent,
  13: migrate13ToCurrent,
  14: migrate14ToCurrent,
  15: migrate15ToCurrent,
  16: migrate16ToCurrent,
  17: migrate17ToCurrent,
  18: migrate18ToCurrent,
  19: migrate19ToCurrent,
  20: migrate20ToCurrent,
}

export type PersistentState = PersistentState_20

export const defaultPersistentState: PersistentState = {
  schemaVersion: 20,
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
  if (!data) {
    return { status: MigrationStatus.NoData }
  }
  if (!(data.schemaVersion in stateMigrations)) {
    // A blob we can't read is not a fresh install — a downgrade from a future
    // schema lands here. Failed keeps the keychain untouched and quarantines a
    // redacted copy instead of destroying the session credential.
    return {
      status: MigrationStatus.Failed,
      error: new Error(
        `Unrecognized persistent state schemaVersion: ${String(data.schemaVersion)}`,
      ),
      rawData: data,
    }
  }
  const schemaVersion:
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19 = data.schemaVersion
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
