import {
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentStatus,
  PaymentType,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  type BreezSdkInterface,
  type Network,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { disconnectSdk, getWalletInfo, initSdk, listPayments } from "./bridge"
import { storageDirFor } from "./config"
import { classifySdkError, SelfCustodialErrorCode } from "./sdk-error"

export const MigrationSdkStatus = {
  Ok: "ok",
  NoMnemonic: "no-mnemonic",
  ConnectionError: "connection-error",
  Failed: "failed",
} as const

export type MigrationSdkStatus =
  (typeof MigrationSdkStatus)[keyof typeof MigrationSdkStatus]

type MigrationSdkResult<T> =
  | { status: typeof MigrationSdkStatus.Ok; value: T }
  | { status: typeof MigrationSdkStatus.NoMnemonic }
  | { status: typeof MigrationSdkStatus.ConnectionError; error: Error }
  | { status: typeof MigrationSdkStatus.Failed; error: Error }

type MigrationSdkConnectionArgs = {
  accountId: string
  network: Network
  leewaySatPerVbyte: number
}

type WithMigrationSdkArgs = MigrationSdkConnectionArgs & {
  /** Built by the caller, which owns the backend's challenge format, from the pubkey the
   *  wallet hands back. */
  signChallenge: (sparkPubkey: string) => string
}

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err))

/**
 * A network-tagged SDK error (a connection dropped during the connect or the call) can be
 * sent again, so it is surfaced as a connection error the caller retries rather than a
 * settled failure that hands the user to support. Every other error is settled.
 */
const toSdkFailure = (
  err: unknown,
):
  | { status: typeof MigrationSdkStatus.ConnectionError; error: Error }
  | { status: typeof MigrationSdkStatus.Failed; error: Error } => {
  const isNetworkError = classifySdkError(err) === SelfCustodialErrorCode.NetworkError
  const status = isNetworkError
    ? MigrationSdkStatus.ConnectionError
    : MigrationSdkStatus.Failed
  return { status, error: toError(err) }
}

/**
 * One SDK connection at a time per storage directory. The migrating wallet is inactive, so
 * no SDK is connected for it and each call opens its own; two overlapping on the same
 * directory would race two SDKs, the hazard this module exists to avoid. Chaining the runs
 * here covers a retry fired mid-connect and a screen re-mounted over a live attempt alike.
 */
const sdkRunsByStorageDir = new Map<string, Promise<unknown>>()

const runExclusivePerStorageDir = <T>(
  storageDir: string,
  task: () => Promise<T>,
): Promise<T> => {
  const prior = sdkRunsByStorageDir.get(storageDir) ?? Promise.resolve()
  const result = prior.then(task, task)
  /** Store a never-rejecting tail so the next caller for this directory chains behind it.
   *  Entries are per (account, network) and few, so the map is left to hold one tail per
   *  directory rather than reaped, keeping the serialization to a single chain. */
  sdkRunsByStorageDir.set(
    storageDir,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

/**
 * Connects the provisioned-but-inactive self-custodial wallet, runs one unit of work
 * against its SDK, and disconnects. The wallet is not the active session, so no connected
 * SDK exists for it; each call opens its own, serialized per storage directory so two never
 * race. NoMnemonic means the device never held the key (a reinstall) and is the caller's to
 * route; a network-tagged failure is a retryable ConnectionError; any other failure is Failed.
 */
const withMigrationSdk = async <T>(
  { accountId, network, leewaySatPerVbyte }: MigrationSdkConnectionArgs,
  use: (sdk: BreezSdkInterface) => Promise<T>,
): Promise<MigrationSdkResult<T>> => {
  const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
  if (!mnemonic) return { status: MigrationSdkStatus.NoMnemonic }

  const storageDir = storageDirFor(accountId, network)
  return runExclusivePerStorageDir(storageDir, async () => {
    let sdk: BreezSdkInterface | undefined
    try {
      sdk = await initSdk({ mnemonic, storageDir, network, leewaySatPerVbyte })
      const value = await use(sdk)
      return { status: MigrationSdkStatus.Ok, value }
    } catch (err) {
      return toSdkFailure(err)
    } finally {
      if (sdk) {
        await disconnectSdk(sdk).catch((err) => {
          reportError("Migration transfer SDK disconnect", err)
        })
      }
    }
  })
}

/**
 * The signature comes from the SDK rather than the offline signer because `signMessage`
 * SHA256-hashes the message itself, exactly as the backend does when it verifies, where
 * `signEcdsa` would take a digest and hash it a second time.
 */
const signChallengeWith = async (
  sdk: BreezSdkInterface,
  sparkPubkey: string,
  signChallenge: (sparkPubkey: string) => string,
): Promise<string> => {
  const { signature } = await sdk.signMessage({
    message: signChallenge(sparkPubkey),
    compact: true,
  })
  return signature
}

const SECONDS_PER_DAY = 24 * 60 * 60

/**
 * A full day of invoice lifetime. The backend settles the drain within seconds of the
 * commit, so this is far beyond any real payment or retry window, and Spark holds an
 * incoming payment for an offline wallet and claims it on the next sync, so the disconnect
 * right after does not lose it. A long explicit expiry beats leaving it to the SDK's
 * unspecified default: a migration invoice that lapses would strand the transfer.
 */
const MIGRATION_INVOICE_EXPIRY_SECONDS = SECONDS_PER_DAY

/** Exactly the three destination fields `migrationCommit` takes. */
export type MigrationTransferRequest = {
  sparkInvoice: string
  sparkPubkey: string
  proofSignature: string
}

/**
 * Collects what the commit needs to pay a migration into the self-custodial wallet. The
 * pubkey and the invoice are independent, so they resolve together; the signature follows
 * the invoice check so a failed invoice never spends a signature. No amount on the invoice:
 * the server drains what it can and decides the figure, so one naming an amount would only
 * be a second opinion it has to refuse.
 */
export const buildMigrationTransferRequest = (
  args: WithMigrationSdkArgs,
): Promise<MigrationSdkResult<MigrationTransferRequest>> =>
  withMigrationSdk(args, async (sdk) => {
    /** Called directly, not through createReceiveLightning, which flattens a thrown SdkError
     *  to a string: the raw error keeps its tag so a dropped connection stays retryable
     *  rather than a settled handover, exactly as getWalletInfo relies on. */
    const [{ identityPubkey }, response] = await Promise.all([
      getWalletInfo(sdk),
      sdk.receivePayment(
        ReceivePaymentRequest.create({
          paymentMethod: new ReceivePaymentMethod.Bolt11Invoice({
            description: "",
            amountSats: undefined,
            expirySecs: MIGRATION_INVOICE_EXPIRY_SECONDS,
            paymentHash: undefined,
          }),
        }),
      ),
    ])
    const invoice = response.paymentRequest
    if (!invoice) throw new Error("No invoice returned")

    const proofSignature = await signChallengeWith(
      sdk,
      identityPubkey,
      args.signChallenge,
    )
    return { sparkInvoice: invoice, sparkPubkey: identityPubkey, proofSignature }
  })

type MigrationReceiveCheck = {
  hasReceived: boolean
  balanceSats: number
}

/**
 * How far back the settled receive is looked for. The drain settles within seconds of the
 * request, and the wallet is quiet across that window, so the payment is at the head of
 * the list. A page rather than a full scan: a wallet the user brought in can hold years of
 * history, and paging all of it to answer one question would make the check itself the
 * reason the screen hangs.
 */
const RECEIVE_LOOKUP_PAGE_SIZE = 50

const isMigrationReceive = (payment: Payment, sparkInvoice: string): boolean => {
  if (payment.paymentType !== PaymentType.Receive) return false
  if (payment.status !== PaymentStatus.Completed) return false
  if (payment.details?.tag !== PaymentDetailsTags.Lightning) return false
  return payment.details.inner.invoice === sparkInvoice
}

/**
 * Whether the migration payment has landed in the target wallet.
 *
 * It matches the invoice this flow issued for this migration, rather than reading the
 * balance. A balance test only works while the target is a wallet this flow provisioned
 * and nothing else could have funded — the moment the user supplies their own wallet, or
 * an unrelated payment arrives mid-flow, "balance above zero" stops meaning "the drain
 * landed" and the completion step deletes the custodial account over funds still in
 * transit (#4102). The invoice is issued per migration and payable once, so nothing else
 * can satisfy it.
 *
 * The forced sync is still the point of the call — Spark holds an incoming payment for an
 * offline wallet and claims it on sync, so this remains the detector and the actuator in
 * one. `balanceSats` is still reported, now for diagnostics rather than for the verdict.
 */
export const checkMigrationReceiveLanded = (
  args: MigrationSdkConnectionArgs & { sparkInvoice: string | null },
): Promise<MigrationSdkResult<MigrationReceiveCheck>> =>
  withMigrationSdk(args, async (sdk) => {
    const info = await sdk.getInfo({ ensureSynced: true })
    const balanceSats = Number(info.balanceSats)

    /**
     * No invoice, no proof. Deliberately not a fall back to the balance test: that test is
     * only sound while the target is a wallet this flow provisioned and nothing else could
     * have funded, and every route that loses the invoice — a checkpoint written before the
     * field existed, a commit whose response never came, a stale reader — arrives here
     * looking exactly like one that has it. Answering by balance on any of them is how
     * #4102 comes back, so the unprovable case stays unproven and the flow takes its
     * existing delayed-receive path instead.
     */
    const { sparkInvoice } = args
    if (sparkInvoice === null) return { hasReceived: false, balanceSats }

    const { payments } = await listPayments(sdk, 0, RECEIVE_LOOKUP_PAGE_SIZE)
    const hasReceived = payments.some((payment) =>
      isMigrationReceive(payment, sparkInvoice),
    )

    return { hasReceived, balanceSats }
  })

/** The two proof fields `migrationLnAddressTransfer` takes; it re-points the lightning
 *  address rather than moving funds, so it needs no invoice, only the proof of possession. */
type MigrationLnAddressProof = {
  sparkPubkey: string
  proofSignature: string
}

export const buildMigrationLnAddressProof = (
  args: WithMigrationSdkArgs,
): Promise<MigrationSdkResult<MigrationLnAddressProof>> =>
  withMigrationSdk(args, async (sdk) => {
    const { identityPubkey } = await getWalletInfo(sdk)
    const proofSignature = await signChallengeWith(
      sdk,
      identityPubkey,
      args.signChallenge,
    )
    return { sparkPubkey: identityPubkey, proofSignature }
  })
