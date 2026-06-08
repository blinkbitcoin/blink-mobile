import {
  LnurlWithdrawRequest,
  LnurlWithdrawRequestDetails,
  PaymentStatus,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { type LnurlWithdrawAdapter, PaymentResultStatus } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

import { classifySdkError, getSdkErrorReason } from "../sdk-error"

// Without this, the SDK returns immediately after firing the LNURL callback and the screen would show success before the payment actually arrives.
const DEFAULT_COMPLETION_TIMEOUT_SECS = 120

export const createLnurlWithdraw = (sdk: BreezSdkInterface): LnurlWithdrawAdapter => {
  return async (params) => {
    const {
      amountSats,
      callback,
      k1,
      defaultDescription,
      minWithdrawableMsats,
      maxWithdrawableMsats,
      completionTimeoutSecs = DEFAULT_COMPLETION_TIMEOUT_SECS,
      signal,
    } = params

    const withdrawRequest = LnurlWithdrawRequestDetails.create({
      callback,
      k1,
      defaultDescription,
      minWithdrawable: BigInt(minWithdrawableMsats),
      maxWithdrawable: BigInt(maxWithdrawableMsats),
    })

    const request = LnurlWithdrawRequest.create({
      amountSats: BigInt(amountSats),
      withdrawRequest,
      completionTimeoutSecs,
    })

    try {
      const response = await sdk.lnurlWithdraw(request, signal ? { signal } : undefined)

      // On the completion-timeout the SDK resolves without a settled payment; treat anything but a completed payment as pending so the screen never reports premature success.
      return response?.payment?.status === PaymentStatus.Completed
        ? { status: PaymentResultStatus.Success }
        : { status: PaymentResultStatus.Pending }
    } catch (err) {
      reportError("lnurlWithdraw", err)

      const code = classifySdkError(err)
      return {
        status: PaymentResultStatus.Failed,
        errors: [{ message: code, reason: getSdkErrorReason(err) }],
      }
    }
  }
}
