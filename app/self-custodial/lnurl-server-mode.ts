import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { AccountMode } from "@app/types/account"

import { getWalletInfo } from "./bridge/wallet"

/** The server refuses a request whose timestamp is further than this from its own clock,
 *  so a stalled request is dropped rather than sent to be rejected. */
const MODE_REQUEST_TIMEOUT_MS = 15_000

/** The server answers this when it holds no account for the pubkey at all. */
const NOT_FOUND_STATUS = 404

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
 * the wallet signed with. `mode:` domain-separates the message from the register and
 * transfer signatures, which the server verifies against the same key.
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
    message: `mode:${mode}:${identityPubkey}-${timestamp}`,
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
 */
export const recoverLnurlServerMode = async ({
  sdk,
  serverUrl,
}: LnurlServerRequestArgs): Promise<AccountMode | null> => {
  const { identityPubkey } = await getWalletInfo(sdk)
  const timestamp = Math.floor(Date.now() / 1000)

  /** No `mode:` prefix: recover signs the bare pubkey, like register and unregister. */
  const { signature } = await sdk.signMessage({
    message: `${identityPubkey}-${timestamp}`,
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
