import { TurboModuleRegistry, NativeModules } from "react-native"

interface SourceCodeTurboModule {
  getConstants(): {
    scriptURL: string
  }
}

// this is used for local development
// will typically return localhost
const scriptHostname = (): string => {
  const turboModule =
    TurboModuleRegistry.getEnforcing<SourceCodeTurboModule>("SourceCode")
  const turboScriptURL = turboModule?.getConstants?.()?.scriptURL

  const { scriptURL } = NativeModules.SourceCode || {}
  const urlToUse = turboScriptURL || scriptURL

  if (!urlToUse) {
    return "localhost"
  }

  const parts = urlToUse.split("://")
  if (parts.length < 2) {
    return "localhost"
  }

  const hostPart = parts[1]?.split(":")[0]
  return hostPart ?? "localhost"
}

export const possibleGaloyInstanceNames = ["Main", "Staging", "Local", "Custom"] as const
export type GaloyInstanceName = (typeof possibleGaloyInstanceNames)[number]

export type StandardInstance = {
  id: "Main" | "Staging" | "Local"
}

export type CustomInstance = {
  id: "Custom"
  name: string
  graphqlUri: string
  graphqlWsUri: string
  authUrl: string
  kycUrl: string
  posUrl: string
  lnAddressHostname: string
  blockExplorer: string
  fiatUrl: string
}

export type GaloyInstanceInput = StandardInstance | CustomInstance

export type GaloyInstance = {
  id: GaloyInstanceName
  name: string
  graphqlUri: string
  graphqlWsUri: string
  authUrl: string
  kycUrl: string
  posUrl: string
  lnAddressHostname: string
  blockExplorer: string
  fiatUrl: string
}

export const resolveGaloyInstanceOrDefault = (
  input: GaloyInstanceInput,
): GaloyInstance => {
  if (input.id === "Custom") {
    return input
  }

  const instance = GALOY_INSTANCES.find((instance) => instance.id === input.id)

  // branch only to please typescript. Array,find have T | undefined as return type
  if (instance === undefined) {
    console.error("instance not found") // should not happen
    return GALOY_INSTANCES[0]
  }

  return instance
}

export const GALOY_INSTANCES: readonly GaloyInstance[] = [
  {
    id: "Main",
    name: "Blink",
    graphqlUri: "https://api.blink.sv/graphql",
    graphqlWsUri: "wss://ws.blink.sv/graphql",
    authUrl: "https://api.blink.sv",
    posUrl: "https://pay.blink.sv",
    kycUrl: "https://kyc.blink.sv",
    lnAddressHostname: "blink.sv",
    blockExplorer: "https://mempool.space/tx/",
    fiatUrl: "https://fiat.blink.sv",
  },
  {
    id: "Staging",
    name: "Staging",
    graphqlUri: "https://api.staging.blink.sv/graphql",
    graphqlWsUri: "wss://ws.staging.blink.sv/graphql",
    authUrl: "https://api.staging.blink.sv",
    posUrl: "https://pay.staging.blink.sv",
    kycUrl: "https://kyc.staging.blink.sv",
    lnAddressHostname: "pay.staging.blink.sv",
    blockExplorer: "https://mempool.space/signet/tx/",
    fiatUrl: "https://fiat.staging.blink.sv",
  },
  {
    id: "Local",
    name: "Local",
    graphqlUri: `http://${scriptHostname()}:4455/graphql`,
    graphqlWsUri: `ws://${scriptHostname()}:4455/graphqlws`,
    authUrl: `http://${scriptHostname()}:4455`,
    posUrl: `http://${scriptHostname()}:3000`,
    kycUrl: `http://${scriptHostname()}:3000`,
    lnAddressHostname: `${scriptHostname()}:3000`,
    blockExplorer: "https://mempool.space/signet/tx/",
    fiatUrl: `http://${scriptHostname()}:3000`,
  },
] as const
