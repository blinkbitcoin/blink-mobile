import {
  AmountAdjustmentReason,
  PrepareSendPaymentResponse,
  SendPaymentRequest,
  SyncWalletRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  FEE_TIER_ETA_MINUTES,
  failedPayment,
  failedReceive,
  FeeMode,
  FeeQuoteType,
  FeeTier,
  PaymentResultStatus,
  type ConvertAdapter,
  type ConvertParams,
  type ConvertQuote,
  type GetFeeAdapter,
  type PaymentAdapterResult,
  type ReceiveLightningAdapter,
  type ReceiveOnchainAdapter,
  type SendPaymentAdapter,
} from "@app/types/payment"
import { tokenBaseUnitsToCents } from "@app/utils/amounts"
import { reportError } from "@app/utils/error-logging"
import { toNumber } from "@app/utils/helper"

import {
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  prepareConversion,
  prepareReceiveBolt11,
  prepareReceiveOnchain,
  prepareSend,
  recordConvertError,
  recordReceiveError,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
  type PreparedConversion,
} from "../bridge"

const LIGHTNING_INVOICE_FAILED_MESSAGE = "Lightning invoice creation failed"
const ONCHAIN_ADDRESS_FAILED_MESSAGE = "Onchain address creation failed"

export const createSendPayment = (sdk: BreezSdkInterface): SendPaymentAdapter => {
  return async ({ destination, amount }) => {
    try {
      const currency = amount?.currency ?? WalletCurrency.Btc
      const prepared = await prepareSend(sdk, {
        paymentRequest: destination,
        amount: amount ? toSdkSendAmount(amount.amount, currency) : undefined,
        tokenIdentifier: resolveSendTokenIdentifier(currency),
      })
      await executeSend(sdk, prepared)

      return { status: PaymentResultStatus.Success }
    } catch (err) {
      return failedPayment(err instanceof Error ? err.message : `Send failed: ${err}`)
    }
  }
}

export const createGetFee = (sdk: BreezSdkInterface): GetFeeAdapter => {
  return async ({ destination, amount, feeTier }) => {
    try {
      const currency = amount?.currency ?? WalletCurrency.Btc
      const prepared = await prepareSend(sdk, {
        paymentRequest: destination,
        amount: amount ? toSdkSendAmount(amount.amount, currency) : undefined,
        tokenIdentifier: resolveSendTokenIdentifier(currency),
      })

      const onchainFees = extractOnchainFees(prepared)
      if (onchainFees) {
        const tier = feeTier ?? FeeTier.Fast
        const feeSats = onchainFees[tier]
        const amountSats = toNumber(prepared.amount)
        return {
          paymentType: FeeQuoteType.Onchain,
          feeAmount: toBtcMoneyAmount(feeSats),
          feeTier: tier,
          feeMode: FeeMode.PaySeparately,
          recipientAmount: toBtcMoneyAmount(amountSats),
          totalDebited: toBtcMoneyAmount(amountSats + feeSats),
          confirmationEtaMinutes: FEE_TIER_ETA_MINUTES[tier],
        }
      }

      const lnFee = extractLightningFee(prepared)
      if (lnFee !== null) {
        return {
          paymentType: FeeQuoteType.Lightning,
          feeAmount: toBtcMoneyAmount(lnFee),
        }
      }

      return {
        paymentType: FeeQuoteType.Lightning,
        feeAmount: toBtcMoneyAmount(0),
      }
    } catch (err) {
      reportError("[SparkSDK] Fee quote", err)
      return null
    }
  }
}

const mapAmountAdjustment = (
  reason: AmountAdjustmentReason | undefined,
): ConvertAmountAdjustment | undefined => {
  if (reason === AmountAdjustmentReason.FlooredToMinLimit) {
    return ConvertAmountAdjustment.FlooredToMin
  }
  if (reason === AmountAdjustmentReason.IncreasedToAvoidDust) {
    return ConvertAmountAdjustment.IncreasedToAvoidDust
  }
  return undefined
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  prepared: PrepareSendPaymentResponse,
  params: ConvertParams,
): Promise<PaymentAdapterResult> => {
  try {
    await sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared }))
    sdk.syncWallet(SyncWalletRequest.create({})).catch((err) => {
      reportError("convert: post-send syncWallet", err)
    })
    return { status: PaymentResultStatus.Success }
  } catch (err) {
    recordConvertError(err, params, "executePrepared")
    return failedPayment(err instanceof Error ? err.message : `Conversion failed: ${err}`)
  }
}

const toConvertQuote = (
  sdk: BreezSdkInterface,
  { prepared, tokenDecimals }: PreparedConversion,
  params: ConvertParams,
): ConvertQuote | null => {
  const estimate = prepared.conversionEstimate
  if (!estimate) return null
  const feeCents = tokenBaseUnitsToCents(toNumber(estimate.fee), tokenDecimals)
  return {
    feeAmount: toUsdMoneyAmount(feeCents),
    showFeeRow: true,
    amountAdjustment: mapAmountAdjustment(estimate.amountAdjustment),
    execute: () => executePrepared(sdk, prepared, params),
  }
}

export const createSelfCustodialConvert = (sdk: BreezSdkInterface): ConvertAdapter => ({
  getQuote: async (params) => {
    try {
      const context = await prepareConversion(sdk, params)
      return toConvertQuote(sdk, context, params)
    } catch (err) {
      recordConvertError(err, params, "getQuote")
      throw err
    }
  },
})

export const createSelfCustodialReceiveLightning = (
  sdk: BreezSdkInterface,
): ReceiveLightningAdapter => {
  return async ({ amount, memo }) => {
    try {
      const { paymentRequest } = await prepareReceiveBolt11(sdk, {
        amountSats: amount?.amount,
        memo,
      })
      if (!paymentRequest) return failedReceive(LIGHTNING_INVOICE_FAILED_MESSAGE)
      return { invoice: { paymentRequest } }
    } catch (err) {
      return failedReceive(
        err instanceof Error ? err.message : LIGHTNING_INVOICE_FAILED_MESSAGE,
      )
    }
  }
}

export const createSelfCustodialReceiveOnchain = (
  sdk: BreezSdkInterface,
): ReceiveOnchainAdapter => {
  return async ({ walletCurrency }) => {
    try {
      const { address } = await prepareReceiveOnchain(sdk)
      return { address }
    } catch (err) {
      recordReceiveError(err, "createSelfCustodialReceiveOnchain", {
        currency: walletCurrency,
      })
      return failedReceive(
        err instanceof Error ? err.message : ONCHAIN_ADDRESS_FAILED_MESSAGE,
      )
    }
  }
}
