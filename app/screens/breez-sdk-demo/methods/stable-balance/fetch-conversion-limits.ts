import { ConversionType } from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"

import { getBreezClient } from "../../client"

const TOKEN_IDENTIFIER = Config.SPARK_TOKEN_IDENTIFIER ?? ""

export const fetchConversionLimitsBtcToToken = async () => {
  const sdk = await getBreezClient()

  return sdk.fetchConversionLimits({
    conversionType: new ConversionType.FromBitcoin(),
    tokenIdentifier: TOKEN_IDENTIFIER,
  })
}

export const fetchConversionLimitsTokenToBtc = async () => {
  const sdk = await getBreezClient()

  return sdk.fetchConversionLimits({
    conversionType: new ConversionType.ToBitcoin({
      fromTokenIdentifier: TOKEN_IDENTIFIER,
    }),
    tokenIdentifier: undefined,
  })
}
