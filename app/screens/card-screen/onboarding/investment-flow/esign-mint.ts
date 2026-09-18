/**
 * The call to the e-sign service that mints a signing session: it creates the envelope
 * from the agreement's templates with the values written onto the documents and locked,
 * and hands back the url the signer opens.
 *
 * Everything the signed document states travels in this call, as `investment-agreement`
 * decided it. The service writes what it is told and locks what it is told to lock.
 */

import type { RecipientData } from "@blinkbitcoin/esign-react-native/webform"

import { scriptHostname } from "@app/config/galoy-instances"

import {
  type AgreementPrefill,
  type MintedAgreement,
  signingFailure,
  signingRefusal,
  signingUnauthorized,
  signingUnreachable,
} from "./investment-agreement"

/** Where the service mints envelopes; it serves the return-url bridge beside it. */
const ENVELOPE_INSTANCE_PATH = "/envelope/instance"

/** Where the service listens on a developer's own machine, taken from the address Metro
 *  already told the device to load from, so it holds on an emulator, a simulator and a
 *  real device alike. */
const LOCAL_MINT_ORIGIN = `http://${scriptHostname()}:4100`

/**
 * The origin serving the mint. It also serves the page the signing outcome comes back
 * through, though on this platform the events that page posts are not checked against
 * it, so the origin is only what the call is made to.
 *
 * While no instance names one, a debug build falls back to a service on the developer's
 * own machine, which is what lets the flow be exercised before the service is deployed.
 * A release build does not: it would be pointing every user's phone at their own device,
 * so the step reports a mint it cannot reach, which is the truth.
 */
export const resolveMintOrigin = (configured: string): string => {
  if (configured) return configured

  return __DEV__ ? LOCAL_MINT_ORIGIN : ""
}

/** The status the service answers a request it refuses with, the reason attached, and
 *  the one it answers a session it will not take with. */
const REFUSED_STATUS = 400
const UNAUTHORIZED_STATUS = 401

/** What a mint that answered as if it succeeded, but named nothing to open, is reported as. */
const EMPTY_ANSWER_REASON = "the service answered without a url"

type MintSigningInstanceInput = {
  origin: string
  /** The caller's session, which the service verifies before it mints. */
  token: string
  recipient: RecipientData
  prefill: AgreementPrefill
}

type MintAnswer = {
  url?: string
  envelopeId?: string
  error?: string
}

/** The failure the answer stands for, under the code the signing component reads. */
const failureOf = (status: number, reason: string): Error => {
  if (status === REFUSED_STATUS) return signingRefusal(reason)
  if (status === UNAUTHORIZED_STATUS) return signingUnauthorized(reason)

  return signingFailure(reason)
}

export const mintSigningInstance = async ({
  origin,
  token,
  recipient,
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
    body: JSON.stringify({ recipient, prefill }),
  }).catch((error: unknown) => {
    throw signingUnreachable(error instanceof Error ? error.message : String(error))
  })

  /** A port that answers with something other than JSON is still a failed mint, and
   *  reporting it as a parse error would hide the status that explains why. */
  const answer: MintAnswer | null = await response.json().catch(() => null)

  if (response.ok && answer?.url) {
    return { url: answer.url, envelopeId: answer.envelopeId }
  }

  const reason = response.ok ? EMPTY_ANSWER_REASON : `HTTP ${response.status}`

  throw failureOf(response.status, answer?.error ?? reason)
}
