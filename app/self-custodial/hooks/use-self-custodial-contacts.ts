import { useCallback, useEffect, useState } from "react"

import {
  type BreezSdkInterface,
  type Contact as SdkContact,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  type Contact,
  type ContactAdapter,
  type ContactListResult,
  type ContactTransactionsPage,
} from "@app/types/contact"
import { AccountType } from "@app/types/wallet"

import {
  findOrCreateContact as bridgeFindOrCreateContact,
  deleteContact as bridgeDeleteContact,
  listContacts as bridgeListContacts,
  updateContact as bridgeUpdateContact,
} from "../bridge"
import { fetchContactPaymentsPage } from "../providers/contact-payments"
import { useSelfCustodialWallet } from "../providers/wallet"

const EMPTY_TRANSACTIONS_PAGE: ContactTransactionsPage = {
  transactions: [],
  nextCursor: null,
}

/**
 * The cursor this adapter hands out is a stringified SDK offset. Anything else is not
 * ours to interpret, so it restarts from the beginning rather than passing NaN to the SDK
 * and looping forever on a request that can never advance.
 */
const toRawOffset = (cursor?: string | null): number => {
  const offset = Number(cursor)
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
}

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
    async (
      paymentIdentifier: string,
      cursor?: string | null,
    ): Promise<ContactTransactionsPage> => {
      if (!sdk) return EMPTY_TRANSACTIONS_PAGE

      const page = await fetchContactPaymentsPage(
        sdk,
        paymentIdentifier,
        toRawOffset(cursor),
      )

      return {
        transactions: page.transactions,
        nextCursor: page.hasMore ? String(page.rawOffset) : null,
      }
    },
    [sdk],
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
