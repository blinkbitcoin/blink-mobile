import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { AccountMode } from "@app/types/account"

import { getWalletInfo } from "./bridge/wallet"

/** The server refuses a request whose timestamp is further than this from its own clock,
 *  so a stalled request is dropped rather than sent to be rejected. */
const MODE_REQUEST_TIMEOUT_MS = 15_000

/** The server answers this when it holds no account for the pubkey at all. */
const NOT_FOUND_STATUS = 404

/**
 * Version prefix of the messages the app signs for itself. The SDK signs its own requests
 * as `breez-lnurl:v2` and refuses to sign anything in that namespace, so these mirror its
 * shape under a namespace of our own, which the server verifies alongside it.
 */
const BLINK_MESSAGE_VERSION = "blink-lnurl:v1"

type BlinkSignedMessageArgs = {
  /** The route this signature authorizes, spelled as the server spells it. */
  route: "recover" | "mode"
  /** The host the request names, which the server rebuilds the message with. */
  domain: string
  pubkey: string
  /** Only `mode` carries one, between the pubkey and the timestamp. */
  mode?: AccountMode
  timestamp: number
}

/**
 * The message blink-lnurl-server rebuilds to verify one of the two routes the app signs
 * itself: the fields LF-joined, version first, no trailing newline.
 *
 * Naming the route and the host is the point of it. The pre-v2 message was the bare
 * `{pubkey}-{timestamp}`, which the server also rebuilds for `/metadata` and
 * `/invoices-paid`, so a captured recover signature could be replayed inside the freshness
 * window to read an account's payment metadata; and it named no host, so a mode signature
 * authorized that mode on any deployment the server answers for.
 */
export const blinkSignedMessage = ({
  route,
  domain,
  pubkey,
  mode,
  timestamp,
}: BlinkSignedMessageArgs): string =>
  [
    BLINK_MESSAGE_VERSION,
    route,
    domain,
    pubkey,
    ...(mode === undefined ? [] : [mode]),
    String(timestamp),
  ].join("\n")

/**
 * The host the message names: the one this request is addressed to, which is what the
 * server reads off the request and rebuilds the message with. Taken from the URL being
 * posted to rather than from configuration, so the two cannot drift apart, and read through
 * the URL parser, which lowercases the host for us — the server lowercases its side too, so
 * a mixed-case URL would otherwise sign a host it never answers for. A URL that will not
 * parse throws, which is a misconfigured build: a message bound to the wrong host would be
 * refused by the server anyway, and less legibly.
 */
const requestDomain = (serverUrl: string): string => new URL(serverUrl).host

type LnurlServerRequestArgs = {
  sdk: BreezSdkInterface
  serverUrl: string
}

type SetLnurlServerModeArgs = LnurlServerRequestArgs & {
  mode: AccountMode
}

/**
 * Tells the LNURL server which region posture an account holds. Enhanced is what lets the
 * server mint invoices for the account's Lightning Address and record the country it saw;
 * Anon stops both, which is how the address goes dormant without the username being given
 * up. The address is therefore never registered or deleted from here: the mode alone
 * decides whether it answers, so a switch cannot cost the user their name.
 *
 * Authorization is the signature and nothing else, so the pubkey in the path is the one
 * the wallet signed with. The message names the route, the host and the mode, so the
 * signature authorizes this mode on this deployment and nothing else.
 */
export const setLnurlServerMode = async ({
  sdk,
  serverUrl,
  mode,
}: SetLnurlServerModeArgs): Promise<void> => {
  const { identityPubkey } = await getWalletInfo(sdk)
  /** The server's anti-rollback anchor: it stores this verbatim and refuses anything not
   *  strictly newer, so it is read as late as possible. */
  const timestamp = Math.floor(Date.now() / 1000)

  /** DER, not compact: the server parses the signature in DER. */
  const { signature } = await sdk.signMessage({
    message: blinkSignedMessage({
      route: "mode",
      domain: requestDomain(serverUrl),
      pubkey: identityPubkey,
      mode,
      timestamp,
    }),
    compact: false,
  })

  const response = await postSigned(`${serverUrl}/lnurlpay/${identityPubkey}/mode`, {
    mode,
    signature,
    timestamp,
  })

  if (!response.ok) {
    throw new Error(`LNURL server refused mode '${mode}' with ${response.status}`)
  }
}

/**
 * Reads back the mode the server holds, which is what a restored wallet has instead of an
 * answer from the user: the mode was chosen on a device this one may never have been.
 *
 * Null means no mode is held — the server was never told, or has never heard of the
 * wallet. Both leave the caller nothing to honor. A refusal throws instead, so "could not
 * ask" stays distinguishable from "holds none".
 *
 * This is the app's own recover, not the SDK's: it answers with the mode, which the SDK's
 * own `breez-lnurl:v2` recover does not carry.
 */
export const recoverLnurlServerMode = async ({
  sdk,
  serverUrl,
}: LnurlServerRequestArgs): Promise<AccountMode | null> => {
  const { identityPubkey } = await getWalletInfo(sdk)
  const timestamp = Math.floor(Date.now() / 1000)

  /** No mode field: recover reads one rather than setting it. */
  const { signature } = await sdk.signMessage({
    message: blinkSignedMessage({
      route: "recover",
      domain: requestDomain(serverUrl),
      pubkey: identityPubkey,
      timestamp,
    }),
    compact: false,
  })

  const response = await postSigned(`${serverUrl}/lnurlpay/${identityPubkey}/recover`, {
    signature,
    timestamp,
  })

  if (response.status === NOT_FOUND_STATUS) return null
  if (!response.ok) {
    throw new Error(`LNURL server refused recover with ${response.status}`)
  }

  const { mode } = (await response.json()) as { mode?: string | null }
  return toAccountMode(mode)
}

/** Unknown values read as "no mode": a variant this app does not know cannot be honored,
 *  and treating it as one of ours would misreport what the account holds. */
const toAccountMode = (mode: string | null | undefined): AccountMode | null => {
  if (mode === AccountMode.Enhanced) return AccountMode.Enhanced
  if (mode === AccountMode.Anon) return AccountMode.Anon
  return null
}

/**
 * Signed by hand, because these two routes are the app's own: the SDK speaks to the
 * Lightning address server for itself and exposes none of them. `signMessage` signs the
 * `blink-lnurl:v1` messages above — the only thing it refuses is its own reserved
 * `breez-lnurl:` namespace — and the server has verified them since 0.9.0, so a
 * deployment older than that accepts only the pre-v2 message this no longer sends.
 */
const postSigned = (url: string, body: unknown): Promise<Response> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MODE_REQUEST_TIMEOUT_MS)
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
}
