import * as React from "react"

import { gql } from "@apollo/client"

import { useLnInvoiceCreateOnBehalfOfRecipientMutation } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

gql`
  mutation lnInvoiceCreateOnBehalfOfRecipient(
    $input: LnInvoiceCreateOnBehalfOfRecipientInput!
  ) {
    lnInvoiceCreateOnBehalfOfRecipient(input: $input) {
      errors {
        message
      }
      invoice {
        paymentRequest
      }
    }
  }
`

/**
 * How long the investor has to pay before the invoice stops being payable. Long enough to
 * read the agreement's figures against the amount and confirm, short enough that an
 * abandoned attempt does not leave a payable claim on the account for the rest of the day.
 */
const INVOICE_EXPIRY_MINUTES = "30"

/**
 * What the investment is for, written on the invoice so it reads as a subscription in
 * the receiving account's history rather than as one more incoming payment.
 *
 * English whatever the investor's language, because it is a record rather than a piece
 * of interface: the same payment has to read the same way in the books no matter whose
 * phone it came from. The signer's name belongs beside it and is missing on purpose -
 * the agreement holds it, the app does not, and inventing one from the paying account
 * could name someone other than who signed.
 */
const INVOICE_MEMO = "Blink Private subscription"

export type MintedInvoice = {
  paymentRequest: string
}

/**
 * Asks the recipient's own account for an invoice, for exactly the satoshis the signed
 * agreement names.
 *
 * The amount travels inside the invoice, which is the point: a destination the investor
 * types an amount against could be paid for anything, and the agreement fixes one figure
 * at one rate. This is the only shape that binds the two.
 *
 * The mutation is unauthenticated by design - it is how any payer asks a Blink account
 * for an invoice - so it answers for a custodial and a self-custodial investor alike.
 */
export const useInvestmentInvoice = (): {
  requestInvoice: (
    recipientWalletId: string,
    satoshis: number,
  ) => Promise<MintedInvoice | null>
  isRequesting: boolean
} => {
  const [createInvoice, { loading }] = useLnInvoiceCreateOnBehalfOfRecipientMutation()

  const requestInvoice = React.useCallback(
    async (recipientWalletId: string, satoshis: number) => {
      try {
        const { data } = await createInvoice({
          variables: {
            input: {
              recipientWalletId,
              amount: satoshis,
              memo: INVOICE_MEMO,
              expiresIn: INVOICE_EXPIRY_MINUTES,
            },
          },
        })

        const paymentRequest =
          data?.lnInvoiceCreateOnBehalfOfRecipient.invoice?.paymentRequest

        return paymentRequest ? { paymentRequest } : null
      } catch (error) {
        /** A mutation that never reached the API rejects rather than answering, and an
         *  unhandled rejection here would leave the step silent: no invoice, no message,
         *  no way to tell the investor what happened. */
        reportError("investment-invoice", error)
        return null
      }
    },
    [createInvoice],
  )

  return { requestInvoice, isRequesting: loading }
}
