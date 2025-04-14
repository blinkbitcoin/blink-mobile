import { GALOY_INSTANCES, GaloyInstance, GaloyInstanceInput } from "@app/config"

type LocalStorageState_3 = {
  schemaVersion: 3
  hasShownStableSatsWelcome: boolean
  isUsdDisabled: boolean
  galoyInstance: GaloyInstance
  galoyAuthToken: string
  isAnalyticsEnabled: boolean
}

type LocalStorageState_4 = {
  schemaVersion: 4
  hasShownStableSatsWelcome: boolean
  isUsdDisabled: boolean
  galoyInstance: GaloyInstance
  galoyAuthToken: string
  isAnalyticsEnabled: boolean
}

type LocalStorageState_5 = {
  schemaVersion: 5
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
}

type LocalStorageState_6 = {
  schemaVersion: 6
  galoyInstance: GaloyInstanceInput
  galoyAuthToken: string
}

type LocalStorageState_7 = {
  schemaVersion: 7
  galoyInstance: GaloyInstanceInput
}

const migrate7ToCurrent = (state: LocalStorageState_7): Promise<LocalStorageState> =>
  Promise.resolve(state)

const migrate6ToCurrent = (state: LocalStorageState_6): Promise<LocalStorageState> => {
  const { galoyInstance } = state

  return migrate7ToCurrent({
    galoyInstance,
    schemaVersion: 7,
  })
}

const migrate5ToCurrent = (state: LocalStorageState_5): Promise<LocalStorageState> => {
  return migrate6ToCurrent({
    ...state,
    schemaVersion: 6,
  })
}

const migrate4ToCurrent = (state: LocalStorageState_4): Promise<LocalStorageState> => {
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

const migrate3ToCurrent = (state: LocalStorageState_3): Promise<LocalStorageState> => {
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
  3: (state: LocalStorageState_3) => Promise<LocalStorageState>
  4: (state: LocalStorageState_4) => Promise<LocalStorageState>
  5: (state: LocalStorageState_5) => Promise<LocalStorageState>
  6: (state: LocalStorageState_6) => Promise<LocalStorageState>
  7: (state: LocalStorageState_7) => Promise<LocalStorageState>
}

const stateMigrations: StateMigrations = {
  3: migrate3ToCurrent,
  4: migrate4ToCurrent,
  5: migrate5ToCurrent,
  6: migrate6ToCurrent,
  7: migrate7ToCurrent,
}

export type LocalStorageState = LocalStorageState_7

export const defaultLocalStorageState: LocalStorageState = {
  schemaVersion: 7,
  galoyInstance: { id: "Main" },
}

export const migrateAndGetLocalStorageState = async (
  // TODO: pass the correct type.
  // this is especially important given this is migration code and it's hard to test manually
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<LocalStorageState> => {
  if (Boolean(data) && data.schemaVersion in stateMigrations) {
    const schemaVersion: 3 | 4 | 5 | 6 | 7 = data.schemaVersion
    try {
      const migration = stateMigrations[schemaVersion]
      const localStorageState = await migration(data)
      if (localStorageState) {
        return localStorageState
      }
    } catch (err) {
      console.error({ err }, "error migrating local storage state")
    }
  }

  return defaultLocalStorageState
}

export type SecureStorageState = {
  galoyAuthToken: string
}

export const defaultSecureStorageState: SecureStorageState = {
  galoyAuthToken: "",
}

export type PersistentState = LocalStorageState & SecureStorageState

export const defaultPersistentState: PersistentState = {
  ...defaultLocalStorageState,
  ...defaultSecureStorageState,
}
