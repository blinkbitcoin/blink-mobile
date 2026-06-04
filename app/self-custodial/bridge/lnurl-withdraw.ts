import {
  LnurlWithdrawRequest,
  LnurlWithdrawRequestDetails,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { type LnurlWithdrawAdapter, PaymentResultStatus } from "@app/types/payment"

import { classifySdkError } from "../sdk-error"

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
      await sdk.lnurlWithdraw(request, signal ? { signal } : undefined)
      return { status: PaymentResultStatus.Success }
    } catch (err) {
      const code = classifySdkError(err)
      return { status: PaymentResultStatus.Failed, errors: [{ message: code }] }
    }
  }
}
