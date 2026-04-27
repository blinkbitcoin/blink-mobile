import { type ParsedSparkAddress } from "@app/self-custodial/bridge"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction.types"

import {
  DestinationDirection,
  InvalidDestinationReason,
  type ParseDestinationResult,
} from "./index.types"

export type SparkPaymentDestination = {
  paymentType: typeof SelfCustodialPaymentType.Spark
  valid: true
  address: string
  identityPublicKey: string
}

export const resolveSparkDestination = (
  parsed: ParsedSparkAddress,
): ParseDestinationResult => {
  if (!parsed.networkMatch) {
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.WrongNetwork,
      invalidPaymentDestination: { paymentType: "unknown" as never },
    }
  }

  const destination: SparkPaymentDestination = {
    paymentType: SelfCustodialPaymentType.Spark,
    valid: true,
    address: parsed.address,
    identityPublicKey: parsed.identityPublicKey,
  }

  return {
    valid: true,
    validDestination: destination,
    destinationDirection: DestinationDirection.Send,
    createPaymentDetail: () => {
      throw new Error("Spark destinations must be wrapped via wrapDestination")
    },
  }
}
