/**
 * Mints the signing instance: one call that computes the agreement's terms server side,
 * asks DocuSign for an instance with them locked, and hands back its url.
 *
 * Only the units are sent. What the signed document says comes from the server, which is
 * the whole point of the locked-terms shape: figures prefilled through a url cannot be
 * made read only, so the signer could otherwise edit what they are agreeing to.
 */

import { scriptHostname } from "@app/config/galoy-instances"

/**
 * PLACEHOLDER: the reference backend reads the bearer token as the caller's id, and this
 * is the id its example data is keyed by. A real mint verifies a session, so this has to
 * become the app's own token before the step can be trusted with anyone's signature.
 */
const MINT_TOKEN = "user-1"

/** Where the esign repo's `mint-only-demo` listens, taken from the address Metro already
 *  told the device to load from, so it holds on an emulator, a simulator and a real
 *  device alike. */
const LOCAL_MINT_ORIGIN = `http://${scriptHostname()}:4100`

/**
 * The origin serving the mint, which also serves the return-URL bridge underneath it, so
 * one origin covers both the call and the events the signing page posts back.
 *
 * While no instance names one, a debug build falls back to that local demo, which is what
 * lets the flow be exercised before the backend is deployed. A release build does not: it
 * would be pointing every user's phone at their own device, so the step reports a mint it
 * cannot reach, which is the truth.
 */
export const resolveMintOrigin = (configured: string): string => {
  if (configured) return configured

  return __DEV__ ? LOCAL_MINT_ORIGIN : ""
}

const MINT_MUTATION = `
  mutation InvestSigningUrl($units: Int!) {
    investSigningUrl(units: $units) {
      url
      instanceId
    }
  }
`

type MintedInstance = {
  url: string
  envelopeId?: string
}

export const mintSigningInstance = async (
  origin: string,
  units: number,
): Promise<MintedInstance> => {
  const response = await fetch(origin, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${MINT_TOKEN}`,
    },
    body: JSON.stringify({ query: MINT_MUTATION, variables: { units } }),
  })

  /** A port that answers with something other than JSON is still a failed mint, and
   *  reporting it as a parse error would hide the status that explains why. */
  const body = await response.json().catch(() => null)
  const minted = body?.data?.investSigningUrl

  if (!minted?.url) {
    const reason = body?.errors?.[0]?.message ?? `HTTP ${response.status}`
    throw new Error(`The signing instance could not be minted: ${reason}`)
  }

  return { url: minted.url, envelopeId: minted.instanceId ?? undefined }
}
