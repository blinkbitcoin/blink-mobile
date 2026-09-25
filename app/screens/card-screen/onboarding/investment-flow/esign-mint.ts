/**
 * The call to the e-sign service that mints a signing session: it creates the envelope
 * from the agreement's templates with the values written onto the documents and locked,
 * and hands back the url the signer opens.
 *
 * The figures travel in this call, as `investment-agreement` decided them; who signs and
 * the rest of the signer's details the service asks its host for, per user, and the app
 * neither knows nor sends them.
 */

import { scriptHostname } from "@app/config/galoy-instances"

import {
  type AgreementPrefill,
  type MintedAgreement,
  signingFailure,
  signingRefusal,
  signingRouteMissing,
  signingUnauthorized,
  signingUnreachable,
} from "./investment-agreement"

/**
 * Where the service mints envelopes; it serves the return-url bridge beside it. The
 * client library exports no constant for it, so this is the one place the path is
 * written, and its spec pins the string the service answers on.
 */
export const ENVELOPE_INSTANCE_PATH = "/envelope/instance"

/** Where the service listens on a developer's own machine. */
const LOCAL_MINT_PORT = 4100

/** Only an origin the service can be reached at: a scheme the fetch will make, a plain
 *  host name and at most a port. Nothing that a url parser could read as a different
 *  host than a suffix check does (userinfo, a backslash, an escape, brackets). */
const HTTP_ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i

/**
 * The domains a mint origin named by remote config may live on. The mint is made with
 * the user's session token, so whoever can edit the remote value could otherwise send
 * every investor's token wherever they liked; a release build takes only Blink's own
 * hosts, over https. A debug build takes anything, since that is what points it at a
 * service on the developer's machine.
 */
const TRUSTED_MINT_HOST_SUFFIXES = ["blink.sv", "blinkbtc.com"]

const hostOf = (origin: string): string =>
  origin
    .replace(/^https?:\/\//i, "")
    .split(":")[0]
    .toLowerCase()

const isTrustedMintOrigin = (origin: string): boolean => {
  if (!/^https:/i.test(origin)) return false
  const host = hostOf(origin)
  return TRUSTED_MINT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
}

/**
 * The configured value as an origin, or empty when it is not one. A trailing slash is a
 * copy-paste away and would double up against the path; anything that is not an http(s)
 * origin is not somewhere a mint can be made and reads as not configured.
 */
const asMintOrigin = (configured: string): string => {
  const origin = configured.trim().replace(/\/+$/, "")
  return HTTP_ORIGIN.test(origin) ? origin : ""
}

/**
 * The origin serving the mint. It also serves the page the signing outcome comes back
 * through, which is what a message from the signing page is checked against.
 *
 * While no instance names one, a debug build falls back to a service on the developer's
 * own machine, taken from the address Metro already told the device to load from, so it
 * holds on an emulator, a simulator and a real device alike. A release build does not:
 * it would be pointing every user's phone at their own device, so it answers nothing and
 * the step says signing is not available rather than offering a retry that cannot win.
 */
export const resolveMintOrigin = (configured: string): string => {
  const origin = asMintOrigin(configured)
  if (origin) return origin

  /** Read only here and only in a debug build: the lookup is a turbo-module call a
   *  release build has no reason to make. */
  return __DEV__ ? `http://${scriptHostname()}:${LOCAL_MINT_PORT}` : ""
}

/**
 * The origin remote config names, when a release build may use it: one of Blink's own
 * hosts over https, as an origin. Anything else is ignored rather than followed, so the
 * instance's own value stands.
 */
export const trustedRemoteMintOrigin = (remote: string): string => {
  const origin = asMintOrigin(remote)
  if (!origin) return ""
  if (__DEV__ || isTrustedMintOrigin(origin)) return origin

  return ""
}

/** The statuses the service answers a request it refuses with, the reason attached;
 *  a session it will not take; and a route it does not serve at all. */
const REFUSED_STATUS = 400
const UNAUTHORIZED_STATUS = 401
const ROUTE_MISSING_STATUSES = [404, 405]

/** What a mint that answered as if it succeeded, but named nothing to open, is reported as. */
const EMPTY_ANSWER_REASON = "the service answered without a url"

type MintSigningInstanceInput = {
  origin: string
  /** The caller's session, which the service verifies before it mints, and which its
   *  host reads to tell whose signer details to answer with. */
  token: string
  prefill: AgreementPrefill
}

type MintAnswer = {
  url?: string
  envelopeId?: string
  error?: string
}

/**
 * The failure the answer stands for, under the code the signing component reads. A
 * refusal is worth reading only when the service said why; a bare 400 is as opaque as
 * any other failure, so it gets the retry copy rather than "HTTP 400" on the screen. A
 * route the service does not serve is not cured by tapping again, so it gets its own
 * code and its own copy.
 */
const failureOf = (
  status: number,
  reason: string | undefined,
  fallback: string,
): Error => {
  if (status === UNAUTHORIZED_STATUS)
    return signingUnauthorized(reason ?? fallback, status)
  if (ROUTE_MISSING_STATUSES.includes(status)) {
    return signingRouteMissing(reason ?? fallback, status)
  }
  if (status === REFUSED_STATUS && reason) return signingRefusal(reason, status)

  return signingFailure(reason ?? fallback, status)
}

export const mintSigningInstance = async ({
  origin,
  token,
  prefill,
}: MintSigningInstanceInput): Promise<MintedAgreement> => {
  if (!origin) {
    throw signingFailure("no e-sign service is configured for this environment")
  }

  /** A request that never gets an answer (no network, no route to the service) rejects
   *  with a bare error the component would word as a failed mint; naming it a lost
   *  connection gets the signer the copy that says what to do about it. */
  const response = await fetch(`${origin}${ENVELOPE_INSTANCE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ prefill }),
  }).catch((error: unknown) => {
    throw signingUnreachable(error instanceof Error ? error.message : String(error))
  })

  /** A port that answers with something other than JSON is still a failed mint, and
   *  reporting it as a parse error would hide the status that explains why. */
  const answer: MintAnswer | null = await response.json().catch(() => null)

  if (response.ok && answer?.url) {
    return { url: answer.url, envelopeId: answer.envelopeId }
  }

  /** An empty reason is no reason: the status is what the log needs then. */
  const fallback = response.ok ? EMPTY_ANSWER_REASON : `HTTP ${response.status}`

  throw failureOf(response.status, answer?.error || undefined, fallback)
}
