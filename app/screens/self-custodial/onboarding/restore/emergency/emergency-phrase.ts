import Crypto from "react-native-quick-crypto"

/**
 * Keeps the phrase of an emergency recovery in memory for the screens of that
 * flow, outside navigation state. Route params live in the navigator's history,
 * where they can be inspected, serialized or persisted, and a seed phrase must
 * be none of those; the routes carry only the opaque handle hold returns.
 *
 * One flow at a time: holding a new phrase replaces the previous one, and a
 * handle from an earlier flow reads nothing.
 */
let held: { handle: string; phrase: string } | null = null

export const holdEmergencyPhrase = (phrase: string): string => {
  const handle = Crypto.randomUUID()
  held = { handle, phrase }
  return handle
}

export const readEmergencyPhrase = (handle: string): string | null =>
  held?.handle === handle ? held.phrase : null

/** Only the flow that holds the phrase can drop it, so a screen left over from
 *  an earlier flow cannot wipe a newer one's. */
export const releaseEmergencyPhrase = (handle: string): void => {
  if (held?.handle === handle) held = null
}
