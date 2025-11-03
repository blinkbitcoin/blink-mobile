import React from "react"
import { gql } from "@apollo/client"
import { utils as lnurlUtils } from "lnurl-pay"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContactType, useContactCreateMutation } from "@app/graphql/generated"

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

      await contactCreate({
        variables: { input: { handle, type: ContactType.Lnaddress } },
      })
      return { saved: true, handle }
    },
    [contactCreate],
  )
}
