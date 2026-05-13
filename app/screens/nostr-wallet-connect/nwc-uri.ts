import { DEFAULT_NWC_PERMISSIONS, NWC_PERMISSIONS, NwcPermission } from "./nwc-types"

export const NWC_URI_SCHEME = "nostr+walletconnect:"

export const NWC_AUTH_LINKING_PATH = "nwc-auth"

const NWC_AUTH_LINKING_URL = `blink://${NWC_AUTH_LINKING_PATH}`

const PUBKEY_REGEX = /^[0-9a-f]{64}$/i
const JAVASCRIPT_PROTOCOL = ["java", "script:"].join("")
const BLOCKED_RETURN_URL_PROTOCOLS = new Set([
  "about:",
  "blob:",
  "data:",
  "file:",
  "ftp:",
  JAVASCRIPT_PROTOCOL,
  "mailto:",
  "sms:",
  "tel:",
])
const ALLOWED_RETURN_URL_PROTOCOLS = new Set(["https:", "satsback:"])
const DEV_RETURN_URL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
const URL_PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:$/

const isLocalDevHost = (hostname: string) => DEV_RETURN_URL_HOSTS.has(hostname)

export type NwcUriError =
  | "invalid-uri"
  | "invalid-scheme"
  | "invalid-pubkey"
  | "missing-relay"
  | "invalid-relay"
  | "missing-secret"
  | "unsupported-permissions"

export type ParsedNwcUri =
  | {
      valid: true
      raw: string
      serverPubkey: string
      relay: string
      secret: string
      appName?: string
      returnUrl?: string
      permissions: ReadonlyArray<NwcPermission>
    }
  | {
      valid: false
      raw: string
      error: NwcUriError
    }

export const isNwcUri = (input: string | undefined | null) =>
  input?.trim().toLowerCase().startsWith(NWC_URI_SCHEME) ?? false

export const getNwcAuthorizationLinkingUrl = (uri: string) =>
  `${NWC_AUTH_LINKING_URL}?uri=${encodeURIComponent(uri)}`

export const getSafeNwcReturnUrl = (returnUrl: string | undefined) => {
  if (!returnUrl) return undefined

  const rawReturnUrl = returnUrl.trim()
  if (!rawReturnUrl) return undefined

  try {
    const url = new URL(rawReturnUrl)
    const protocol = url.protocol.toLowerCase()

    if (!URL_PROTOCOL_REGEX.test(protocol)) return undefined
    if (BLOCKED_RETURN_URL_PROTOCOLS.has(protocol)) return undefined

    if (protocol === "http:" || protocol === "https:") {
      if (protocol === "https:") return url.toString()
      return __DEV__ && isLocalDevHost(url.hostname) ? url.toString() : undefined
    }

    return ALLOWED_RETURN_URL_PROTOCOLS.has(protocol) ? url.toString() : undefined
  } catch (_) {
    return undefined
  }
}

const isValidRelayUrl = (relay: string) => {
  try {
    const relayUrl = new URL(relay)
    if (relayUrl.hostname.length === 0) return false
    if (relayUrl.protocol === "wss:") return true
    return relayUrl.protocol === "ws:" && __DEV__ && isLocalDevHost(relayUrl.hostname)
  } catch (_) {
    return false
  }
}

const parsePermissions = (
  url: URL,
): { permissions: ReadonlyArray<NwcPermission>; hasUnsupportedPermissions: boolean } => {
  const rawPermissions =
    url.searchParams.get("required_commands") ?? url.searchParams.get("permissions")

  if (!rawPermissions) {
    return { permissions: DEFAULT_NWC_PERMISSIONS, hasUnsupportedPermissions: false }
  }

  const requestedPermissions = rawPermissions
    .split(/[,\s]+/)
    .map((permission) => permission.trim().toLowerCase())
    .filter(Boolean)

  const permissions: Array<NwcPermission> = []
  let hasUnsupportedPermissions = false
  for (const permission of requestedPermissions) {
    if (NWC_PERMISSIONS.includes(permission as NwcPermission)) {
      permissions.push(permission as NwcPermission)
    } else {
      hasUnsupportedPermissions = true
    }
  }

  return { permissions, hasUnsupportedPermissions }
}

export const parseNwcUri = (input: string): ParsedNwcUri => {
  const raw = input.trim()
  let url: URL

  try {
    url = new URL(raw)
  } catch (_) {
    return { valid: false, raw, error: "invalid-uri" }
  }

  if (url.protocol.toLowerCase() !== NWC_URI_SCHEME) {
    return { valid: false, raw, error: "invalid-scheme" }
  }

  const serverPubkey = url.hostname || url.pathname.replace(/^\/+/, "")
  if (!PUBKEY_REGEX.test(serverPubkey)) {
    return { valid: false, raw, error: "invalid-pubkey" }
  }

  const relay = url.searchParams.get("relay")
  if (!relay) {
    return { valid: false, raw, error: "missing-relay" }
  }

  if (!isValidRelayUrl(relay)) {
    return { valid: false, raw, error: "invalid-relay" }
  }

  const secret = url.searchParams.get("secret")
  if (!secret) {
    return { valid: false, raw, error: "missing-secret" }
  }

  const appName = url.searchParams.get("lud16") ?? undefined
  const unsafeReturnUrl =
    url.searchParams.get("return_to") ?? url.searchParams.get("return_url") ?? undefined
  const returnUrl = getSafeNwcReturnUrl(unsafeReturnUrl)
  const { permissions, hasUnsupportedPermissions } = parsePermissions(url)

  if (hasUnsupportedPermissions || permissions.length === 0) {
    return { valid: false, raw, error: "unsupported-permissions" }
  }

  return {
    valid: true,
    raw,
    serverPubkey,
    relay,
    secret,
    appName,
    returnUrl,
    permissions,
  }
}
