import {
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { getWalletInfo, listAllPayments } from "../bridge"
import { isKnownPayment } from "../mappers/transaction"
import { buildTransactionsCsv } from "../mappers/transaction-csv"

/** Resolves the base64-encoded CSV, or null when the history has nothing exportable. */
export type BuildTransactionsCsvBase64 = () => Promise<string | null>

/** Failed attempts never enter a custodial CSV (the ledger does not record them) and
 *  the history screen hides them, so the export skips them too. */
const isExportable = (payment: Payment): boolean =>
  payment.status !== PaymentStatus.Failed && isKnownPayment(payment)

/**
 * Self-custodial CSV export: the phone is the source of truth, so the CSV is built
 * on-device from the full SDK payment history. Sharing stays with the caller — the
 * settings spinner must end when the CSV is ready, not when a share target app decides
 * to resolve the intent.
 */
export const createBuildTransactionsCsvBase64 =
  (sdk: BreezSdkInterface): BuildTransactionsCsvBase64 =>
  async () => {
    const info = await getWalletInfo(sdk)
    const payments = (await listAllPayments(sdk)).filter(isExportable)
    const csv = buildTransactionsCsv(payments, { identityPubkey: info.identityPubkey })
    if (csv === "") return null
    return Buffer.from(csv, "utf8").toString("base64")
  }
