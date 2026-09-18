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
const INVOICE_EXPIRY_MINUTES = 30

/**
 * How long after issue an invoice is still handed back to be paid, rather than replaced:
 * its life, less a margin for the payment itself to go through before it expires.
 */
const INVOICE_REUSE_MARGIN_MINUTES = 5
const INVOICE_REUSE_WINDOW_MS =
  (INVOICE_EXPIRY_MINUTES - INVOICE_REUSE_MARGIN_MINUTES) * 60 * 1000

export const isInvoiceReusable = (issuedAt: number, now: number): boolean =>
  now - issuedAt < INVOICE_REUSE_WINDOW_MS

/**
 * What the investment is for, written on the invoice so it reads as a subscription in
 * the receiving account's history rather than as one more incoming payment.
 *
 * English whatever the investor's language, because it is a record rather than a piece
 * of interface: the same payment has to read the same way in the books no matter whose
 * phone it came from. It names no one on purpose: the agreement holds the signer's name,
 * and inventing one from the paying account could name someone other than who signed.
 * Who paid, and for which amount, is filed under the invoice's external id instead.
 */
const INVOICE_MEMO = "Blink Private subscription"

/**
 * Whose payment it is and for what: the paying account and the amount signed for, so
 * the receiving ledger can tie each payment to its subscriber without reading memos.
 * The account is null while it is still unknown, and no invoice is minted then: a
 * payment filed under nobody is the one thing the id exists to prevent.
 */
type InvoiceSubscriber = {
  accountId: string | null
  amountUsd: number
}

/**
 * Letters, digits, underscore and hyphen, up to a hundred of them, is what the ledger
 * accepts as an external id; the account id is a lowercase uuid and the amount one of
 * the flow's whole-dollar options, so the two joined by underscores fit as they are.
 *
 * Stamped with the moment, because the ledger keeps the id unique per receiving
 * account and never drops an unpaid invoice: the same investor minting again for the
 * same amount, after letting the first invoice age past reuse, would otherwise be
 * refused for good. Account and amount stay in front, as the part worth searching by.
 */
const resolveInvoiceExternalId = (
  accountId: string,
  amountUsd: number,
  mintedAt: number,
): string => `investment_${accountId}_${amountUsd}_${mintedAt}`

type MintedInvoice = {
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
 * The mutation is unauthenticated by design, since it is how any payer asks a Blink
 * account for an invoice, so it answers for a custodial and a self-custodial investor
 * alike.
 */
export const useInvestmentInvoice = (): {
  requestInvoice: (
    recipientWalletId: string,
    satoshis: number,
    subscriber: InvoiceSubscriber,
  ) => Promise<MintedInvoice | null>
  isRequesting: boolean
} => {
  const [createInvoice, { loading }] = useLnInvoiceCreateOnBehalfOfRecipientMutation()

  const requestInvoice = React.useCallback(
    async (
      recipientWalletId: string,
      satoshis: number,
      subscriber: InvoiceSubscriber,
    ) => {
      if (!subscriber.accountId) {
        reportError(
          "investment-invoice",
          new Error("no account to file the investment payment under"),
        )
        return null
      }

      try {
        const { data } = await createInvoice({
          variables: {
            input: {
              recipientWalletId,
              amount: satoshis,
              memo: INVOICE_MEMO,
              externalId: resolveInvoiceExternalId(
                subscriber.accountId,
                subscriber.amountUsd,
                Date.now(),
              ),
              expiresIn: String(INVOICE_EXPIRY_MINUTES),
            },
          },
        })

        const paymentRequest =
          data?.lnInvoiceCreateOnBehalfOfRecipient.invoice?.paymentRequest
        if (paymentRequest) return { paymentRequest }

        /** The API's own reason, when it gave one, is the one thing that tells a wrong
         *  wallet id apart from an outage, and the investor's screen cannot show it; the
         *  log is where it goes so a misconfiguration is seen rather than guessed. */
        const apiErrors = data?.lnInvoiceCreateOnBehalfOfRecipient.errors ?? []
        if (apiErrors.length > 0) {
          const reasons = apiErrors.map(({ message }) => message)
          reportError("investment-invoice", new Error(reasons.join("; ")))
        }
        return null
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
