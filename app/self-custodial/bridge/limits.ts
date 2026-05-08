import {
  ConversionType,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { ConvertDirection, type ConversionLimits } from "@app/types/payment.types"
import { tokenBaseUnitsToCentsCeil } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { requireSparkTokenIdentifier } from "../config"

import { fetchUsdbDecimals } from "./token-balance"

export const buildConversionType = (direction: ConvertDirection) =>
  direction === ConvertDirection.BtcToUsd
    ? new ConversionType.FromBitcoin()
    : new ConversionType.ToBitcoin({
        fromTokenIdentifier: requireSparkTokenIdentifier(),
      })

const toWalletUnit = (
  raw: bigint | null | undefined,
  assetIsToken: boolean,
  tokenDecimals: number,
): number | null => {
  if (raw === null || raw === undefined) return null
  const value = toNumber(raw)
  if (!assetIsToken) return value
  return tokenBaseUnitsToCentsCeil(value, tokenDecimals)
}

export const fetchConversionLimits = async (
  sdk: BreezSdkInterface,
  direction: ConvertDirection,
  tokenDecimalsHint?: number,
): Promise<ConversionLimits> => {
  const isBtcToUsd = direction === ConvertDirection.BtcToUsd
  const response = await sdk.fetchConversionLimits({
    conversionType: buildConversionType(direction),
    tokenIdentifier: isBtcToUsd ? requireSparkTokenIdentifier() : undefined,
  })

  const tokenDecimals = tokenDecimalsHint ?? (await fetchUsdbDecimals(sdk))

  return {
    minFromAmount: toWalletUnit(response.minFromAmount, !isBtcToUsd, tokenDecimals),
    minToAmount: toWalletUnit(response.minToAmount, isBtcToUsd, tokenDecimals),
  }
}
