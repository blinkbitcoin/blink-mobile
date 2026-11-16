import { useCallback, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks"
import { DisplayCurrency, toBtcMoneyAmount, ZeroUsdMoneyAmount } from "@app/types/amounts"

import { PaymentDetail, PaymentSettled } from "../payment-details/index.types"

/** The hero's amounts, as review quotes them or as the SDK says they went out. */
type HeroText = {
  heroPrimaryText: string
  heroSecondaryText?: string
}

/** What Sent and the receipt write for an amount and its fee. */
export type SentAmountText = HeroText & {
  /** Laid over the receipt's own amounts, which are review's quote. */
  receipt: {
    currencyAmount: string
    satAmount: string
    currencyFeeAmount: string
    satFeeAmount: string
  }
}

/**
 * The texts Sent and the receipt show for what the SDK says went out, written the way
 * review writes its own amounts (blink-wip#2048 SR2).
 *
 * A send whose fee comes out of the amount is prepared again at the slide, so the fee,
 * and with it what arrives, can differ from review's quote. The SDK's figures are the
 * ones that went out, so they are the ones the sender keeps.
 *
 * `hero` is what the hero shows: review's `quoted` texts until `settle` is handed what
 * a send says went out, the SDK's from then on. `settle` returns the texts for that send,
 * with no `receipt` when it reported nothing, so the receipt keeps review's.
 */
export const useSettledAmountText = (
  paymentDetail: PaymentDetail<WalletCurrency>,
  leadsWithWalletCurrency: boolean,
  quoted: HeroText,
) => {
  const { formatMoneyAmount, getSecondaryAmountIfCurrencyIsDifferent } =
    useDisplayCurrency()
  const { convertMoneyAmount, sendingWalletDescriptor } = paymentDetail
  const [sentText, setSentText] = useState<SentAmountText>()

  const textFor = useCallback(
    ({ amountSats, feeSats }: PaymentSettled): SentAmountText => {
      const pair = (sats: number) => {
        const btc = toBtcMoneyAmount(sats)
        const display = convertMoneyAmount(btc, DisplayCurrency)
        const secondary = getSecondaryAmountIfCurrencyIsDifferent({
          primaryAmount: display,
          walletAmount: btc,
          displayAmount: display,
        })
        return { btc, display, secondary }
      }

      const amount = pair(amountSats)
      const fee = pair(feeSats)
      const heroWallet = convertMoneyAmount(amount.btc, sendingWalletDescriptor.currency)
      const heroPrimary = leadsWithWalletCurrency ? heroWallet : amount.display
      const heroSecondary = getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: heroPrimary,
        walletAmount: heroWallet,
        displayAmount: amount.display,
      })

      return {
        heroPrimaryText: formatMoneyAmount({ moneyAmount: heroPrimary }),
        heroSecondaryText:
          heroSecondary && formatMoneyAmount({ moneyAmount: heroSecondary }),
        receipt: {
          currencyAmount: formatMoneyAmount({ moneyAmount: amount.display }),
          satAmount: formatMoneyAmount({
            moneyAmount: amount.secondary ?? ZeroUsdMoneyAmount,
          }),
          currencyFeeAmount: formatMoneyAmount({ moneyAmount: fee.display }),
          satFeeAmount: formatMoneyAmount({
            moneyAmount: fee.secondary ?? ZeroUsdMoneyAmount,
          }),
        },
      }
    },
    [
      convertMoneyAmount,
      sendingWalletDescriptor.currency,
      leadsWithWalletCurrency,
      formatMoneyAmount,
      getSecondaryAmountIfCurrencyIsDifferent,
    ],
  )

  const { heroPrimaryText, heroSecondaryText } = quoted
  const settle = useCallback(
    (settled?: PaymentSettled): HeroText & Partial<Pick<SentAmountText, "receipt">> => {
      if (!settled) return { heroPrimaryText, heroSecondaryText }
      const text = textFor(settled)
      setSentText(text)
      return text
    },
    [textFor, heroPrimaryText, heroSecondaryText],
  )

  return { hero: sentText ?? quoted, settle }
}
