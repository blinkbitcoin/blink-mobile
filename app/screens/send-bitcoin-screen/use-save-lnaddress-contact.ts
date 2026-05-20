import React from "react"
import { gql } from "@apollo/client"
import { utils as lnurlUtils } from "lnurl-pay"
import { PaymentType } from "@blinkbitcoin/blink-client"
import crashlytics from "@react-native-firebase/crashlytics"

import { ContactType, useContactCreateMutation } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { findOrCreateContact as bridgeFindOrCreateContact } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

gql`
  mutation contactCreate($input: ContactCreateInput!) {
    contactCreate(input: $input) {
      errors {
        message
      }
      contact {
        id
      }
    }
  }
`

type SaveLnAddressContactParams = {
  paymentType: PaymentType
  destination: string
  isMerchant?: boolean
}
type SaveLnAddressContactResult = { saved: boolean; handle?: string }

export const useSaveLnAddressContact = () => {
  const [contactCreate] = useContactCreateMutation()
  const { isSelfCustodial } = useActiveWallet()
  const { sdk } = useSelfCustodialWallet()

  return React.useCallback(
    async ({
      paymentType,
      destination,
      isMerchant,
    }: SaveLnAddressContactParams): Promise<SaveLnAddressContactResult> => {
      if (paymentType !== PaymentType.Lnurl) return { saved: false }
      if (isMerchant) return { saved: false }

      const parsed = lnurlUtils.parseLightningAddress(destination)
      if (!parsed) return { saved: false }

      const handle = `${parsed.username}@${parsed.domain}`

      if (isSelfCustodial) {
        if (!sdk) return { saved: false }
        try {
          await bridgeFindOrCreateContact(sdk, handle, handle)
          return { saved: true, handle }
        } catch (err) {
          crashlytics().log(
            `[self-custodial contacts] auto-save failed for ${handle}: ${err}`,
          )
          return { saved: false, handle }
        }
      }

      await contactCreate({
        variables: { input: { handle, type: ContactType.Lnaddress } },
      })
      return { saved: true, handle }
    },
    [contactCreate, isSelfCustodial, sdk],
  )
}
