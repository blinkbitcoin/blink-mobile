import { useMemo, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { gql } from "@apollo/client"
import {
  HomeAuthedDocument,
  PaymentSendResult,
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  useLnInvoicePaymentSendMutation,
  useLnNoAmountInvoicePaymentSendMutation,
  useLnNoAmountUsdInvoicePaymentSendMutation,
  useOnChainPaymentSendMutation,
  useOnChainPaymentSendAllMutation,
  useOnChainUsdPaymentSendAsBtcDenominatedMutation,
  useOnChainUsdPaymentSendMutation,
  Transaction,
} from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"

import { PaymentSendExtraInfo, SendPaymentMutation } from "./payment-details/index.types"

export type PaymentSendCompletedStatus = "SUCCESS" | "PENDING"

type UseSendPaymentResult = {
  loading: boolean
  sendPayment:
    | (() => Promise<{
        status: PaymentSendResult | null | undefined
        transaction?: Partial<Transaction> | null
        errorsMessage?: string
        extraInfo?: PaymentSendExtraInfo
      }>)
    | undefined
    | null
  hasAttemptedSend: boolean
}

gql`
  mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
    intraLedgerPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
    intraLedgerUsdPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {
    lnNoAmountInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
    lnInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
        settlementVia {
          ... on SettlementViaLn {
            preImage
          }
          ... on SettlementViaIntraLedger {
            preImage
          }
        }
      }
    }
  }

  mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {
    lnNoAmountUsdInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {
    onChainPaymentSend(input: $input) {
      transaction {
        createdAt
        settlementVia {
          ... on SettlementViaOnChain {
            arrivalInMempoolEstimatedAt
          }
        }
      }
      errors {
        message
      }
      status
    }
  }

  mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {
    onChainPaymentSendAll(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {
    onChainUsdPaymentSend(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }

  mutation onChainUsdPaymentSendAsBtcDenominated(
    $input: OnChainUsdPaymentSendAsBtcDenominatedInput!
  ) {
    onChainUsdPaymentSendAsBtcDenominated(input: $input) {
      errors {
        message
      }
      status
      transaction {
        createdAt
      }
    }
  }
`

const useGetUuid = () => {
  const randomUuid = useMemo(() => {
    const randomBytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    return uuidv4({ random: randomBytes })
  }, [])
  return randomUuid
}

export const useSendPayment = (
  sendPaymentMutation?: SendPaymentMutation | null,
): UseSendPaymentResult => {
  const idempotencyKey = useGetUuid()

  const options = {
    refetchQueries: [HomeAuthedDocument],
    context: { headers: { "X-Idempotency-Key": idempotencyKey } },
  }

  const [intraLedgerPaymentSend, { loading: intraLedgerPaymentSendLoading }] =
    useIntraLedgerPaymentSendMutation(options)

  const [intraLedgerUsdPaymentSend, { loading: intraLedgerUsdPaymentSendLoading }] =
    useIntraLedgerUsdPaymentSendMutation(options)

  const [lnInvoicePaymentSend, { loading: lnInvoicePaymentSendLoading }] =
    useLnInvoicePaymentSendMutation(options)

  const [lnNoAmountInvoicePaymentSend, { loading: lnNoAmountInvoicePaymentSendLoading }] =
    useLnNoAmountInvoicePaymentSendMutation(options)

  const [
    lnNoAmountUsdInvoicePaymentSend,
    { loading: lnNoAmountUsdInvoicePaymentSendLoading },
  ] = useLnNoAmountUsdInvoicePaymentSendMutation(options)

  const [onChainPaymentSend, { loading: onChainPaymentSendLoading }] =
    useOnChainPaymentSendMutation(options)

  const [onChainPaymentSendAll, { loading: onChainPaymentSendAllLoading }] =
    useOnChainPaymentSendAllMutation(options)

  const [onChainUsdPaymentSend, { loading: onChainUsdPaymentSendLoading }] =
    useOnChainUsdPaymentSendMutation(options)

  const [
    onChainUsdPaymentSendAsBtcDenominated,
    { loading: onChainUsdPaymentSendAsBtcDenominatedLoading },
  ] = useOnChainUsdPaymentSendAsBtcDenominatedMutation(options)

  const [hasAttemptedSend, setHasAttemptedSend] = useState(false)

  const loading =
    intraLedgerPaymentSendLoading ||
    intraLedgerUsdPaymentSendLoading ||
    lnInvoicePaymentSendLoading ||
    lnNoAmountInvoicePaymentSendLoading ||
    lnNoAmountUsdInvoicePaymentSendLoading ||
    onChainPaymentSendLoading ||
    onChainPaymentSendAllLoading ||
    onChainUsdPaymentSendLoading ||
    onChainUsdPaymentSendAsBtcDenominatedLoading

  const sendPayment = useMemo(() => {
    return sendPaymentMutation && !hasAttemptedSend
      ? async () => {
          setHasAttemptedSend(true)
          const { status, errors, extraInfo, transaction } = await sendPaymentMutation({
            intraLedgerPaymentSend,
            intraLedgerUsdPaymentSend,
            lnInvoicePaymentSend,
            lnNoAmountInvoicePaymentSend,
            lnNoAmountUsdInvoicePaymentSend,
            onChainPaymentSend,
            onChainPaymentSendAll,
            onChainUsdPaymentSend,
            onChainUsdPaymentSendAsBtcDenominated,
          })
          let errorsMessage = undefined
          if (errors) {
            errorsMessage = getErrorMessages(errors)
          }
          if (status === PaymentSendResult.Failure) {
            setHasAttemptedSend(false)
          }
          return { status, errorsMessage, extraInfo, transaction }
        }
      : undefined
  }, [
    hasAttemptedSend,
    sendPaymentMutation,
    intraLedgerPaymentSend,
    intraLedgerUsdPaymentSend,
    lnInvoicePaymentSend,
    lnNoAmountInvoicePaymentSend,
    lnNoAmountUsdInvoicePaymentSend,
    onChainPaymentSend,
    onChainPaymentSendAll,
    onChainUsdPaymentSend,
    onChainUsdPaymentSendAsBtcDenominated,
  ])

  return {
    hasAttemptedSend,
    loading,
    sendPayment,
  }
}
