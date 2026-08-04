import {
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { shareCsvBase64 } from "@app/utils/share-csv"

import { getWalletInfo, listAllPayments } from "../bridge"
import { isKnownPayment } from "../mappers/transaction"
import { buildTransactionsCsv } from "../mappers/transaction-csv"

export type ExportTransactionsCsvAdapter = () => Promise<boolean>

/** Failed attempts never enter a custodial CSV (the ledger does not record them) and
 *  the history screen hides them, so the export skips them too. */
const isExportable = (payment: Payment): boolean =>
  payment.status !== PaymentStatus.Failed && isKnownPayment(payment)

/**
 * Self-custodial CSV export: the phone is the source of truth, so the CSV is built
 * on-device from the full SDK payment history and handed to the same share-sheet flow
 * as the custodial export. Same contract: resolves true on share, false on dismissal
 * or an empty history, rejects only on real errors.
 */
export const createExportTransactionsCsv =
  (sdk: BreezSdkInterface): ExportTransactionsCsvAdapter =>
  async () => {
    const info = await getWalletInfo(sdk)
    const payments = (await listAllPayments(sdk)).filter(isExportable)
    const csv = buildTransactionsCsv(payments, { identityPubkey: info.identityPubkey })
    if (csv === "") return false
    return shareCsvBase64(Buffer.from(csv, "utf8").toString("base64"))
  }
