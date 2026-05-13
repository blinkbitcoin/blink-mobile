import { useCallback, useEffect, useState } from "react"

import {
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentType as SdkPaymentType,
  type BreezSdkInterface,
  type Contact as SdkContact,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  type Contact,
  type ContactAdapter,
  type ContactListResult,
} from "@app/types/contact"
import { type NormalizedTransaction } from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"
import { normalizeString } from "@app/utils/helper"

import {
  findOrCreateContact as bridgeFindOrCreateContact,
  deleteContact as bridgeDeleteContact,
  listContacts as bridgeListContacts,
  listPayments as bridgeListPayments,
  updateContact as bridgeUpdateContact,
} from "../bridge"
import { mapSelfCustodialTransactions } from "../mappers/transaction-mapper"
import { useSelfCustodialWallet } from "../providers/wallet"

const MATCHED_PAYMENTS_LIMIT = 100

const mapSdkContact = (c: SdkContact): Contact => ({
  id: c.id,
  displayName: c.name,
  paymentIdentifier: c.paymentIdentifier,
  transactionsCount: 0,
  sourceAccountType: AccountType.SelfCustodial,
})

const noSdkError = (): Error => new Error("Self-custodial wallet is not ready")

const sdkRequired = <T>(
  sdk: BreezSdkInterface | null,
  fn: (sdk: BreezSdkInterface) => Promise<T>,
) => {
  if (!sdk) throw noSdkError()
  return fn(sdk)
}

export const useSelfCustodialContacts = (): ContactAdapter & {
  loading: boolean
} => {
  const { sdk } = useSelfCustodialWallet()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<Contact[]> => {
    if (!sdk) return []
    const raw = await bridgeListContacts(sdk)
    const mapped = raw.map(mapSdkContact)
    setContacts(mapped)
    return mapped
  }, [sdk])

  useEffect(() => {
    if (!sdk) {
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    refresh()
      .catch(() => {
        if (mounted) setContacts([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [sdk, refresh])

  const list = useCallback(async (): Promise<ContactListResult> => {
    const fresh = await refresh()
    return { contacts: fresh }
  }, [refresh])

  const add = useCallback(
    async (
      input: Omit<Contact, "id" | "transactionsCount" | "sourceAccountType">,
    ): Promise<ContactListResult> => {
      await sdkRequired(sdk, (s) =>
        bridgeFindOrCreateContact(s, input.paymentIdentifier, input.displayName),
      )
      const updated = await refresh()
      return { contacts: updated }
    },
    [sdk, refresh],
  )

  const update = useCallback(
    async (
      id: string,
      changes: Partial<Omit<Contact, "id" | "sourceAccountType">>,
    ): Promise<ContactListResult> => {
      const target = contacts.find((c) => c.id === id)
      if (!target) throw new Error(`Contact ${id} not found`)

      await sdkRequired(sdk, (s) =>
        bridgeUpdateContact(s, {
          id,
          name: changes.displayName ?? target.displayName,
          paymentIdentifier: changes.paymentIdentifier ?? target.paymentIdentifier,
        }),
      )
      const updated = await refresh()
      return { contacts: updated }
    },
    [contacts, sdk, refresh],
  )

  const remove = useCallback(
    async (id: string): Promise<ContactListResult> => {
      await sdkRequired(sdk, (s) => bridgeDeleteContact(s, id))
      const updated = await refresh()
      return { contacts: updated }
    },
    [sdk, refresh],
  )

  const getTransactions = useCallback(
    async (contactId: string): Promise<NormalizedTransaction[]> => {
      if (!sdk) return []
      const target = contacts.find((c) => c.id === contactId)
      if (!target) return []

      const normalizedIdentifier = normalizeString(target.paymentIdentifier)
      const response = await bridgeListPayments(sdk, 0, MATCHED_PAYMENTS_LIMIT)

      const matched = response.payments.filter((payment) => {
        if (payment.paymentType !== SdkPaymentType.Send) return false

        const details = payment.details
        if (!details || details.tag !== PaymentDetailsTags.Lightning) return false

        const lnAddress = details.inner.lnurlPayInfo?.lnAddress
        if (!lnAddress) return false

        return normalizeString(lnAddress) === normalizedIdentifier
      })

      return mapSelfCustodialTransactions(matched)
    },
    [contacts, sdk],
  )

  return {
    capabilities: {
      canAdd: true,
      canDelete: true,
      canEditPaymentIdentifier: true,
    },
    list,
    add,
    update,
    delete: remove,
    getTransactions,
    loading,
  }
}
