import { useCallback, useMemo } from "react"

import {
  useContactsQuery,
  useUserContactUpdateAliasMutation,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import {
  type Contact,
  type ContactAdapter,
  type ContactListResult,
} from "@app/types/contact"
import { AccountType } from "@app/types/wallet"
import { type NormalizedTransaction } from "@app/types/transaction"

const unsupported = (operation: string): Error =>
  new Error(`Custodial contacts do not support ${operation}`)

const buildContacts = (
  raw: ReadonlyArray<{
    id: string
    handle: string
    username: string
    alias?: string | null
    transactionsCount: number
  }>,
): Contact[] =>
  raw.map((c) => ({
    id: c.id,
    displayName: c.alias && c.alias.trim().length > 0 ? c.alias : c.username,
    paymentIdentifier: c.username,
    transactionsCount: c.transactionsCount,
    sourceAccountType: AccountType.Custodial,
  }))

export const useCustodialContactAdapter = (): ContactAdapter & {
  loading: boolean
} => {
  const isAuthed = useIsAuthed()
  const { data, loading, refetch } = useContactsQuery({ skip: !isAuthed })
  const [updateAlias] = useUserContactUpdateAliasMutation()

  const rawContacts = data?.me?.contacts
  const contacts = useMemo(() => buildContacts(rawContacts ?? []), [rawContacts])

  const list = useCallback(
    async (): Promise<ContactListResult> => ({ contacts }),
    [contacts],
  )

  const update = useCallback(
    async (
      id: string,
      changes: Partial<Omit<Contact, "id" | "sourceAccountType">>,
    ): Promise<ContactListResult> => {
      if (changes.paymentIdentifier !== undefined) {
        throw unsupported("editing the payment identifier")
      }
      const target = contacts.find((c) => c.id === id)
      if (!target) throw new Error(`Contact ${id} not found`)
      if (changes.displayName === undefined) return { contacts }

      await updateAlias({
        variables: {
          input: {
            username: target.paymentIdentifier,
            alias: changes.displayName,
          },
        },
      })
      const refreshed = await refetch()
      return { contacts: buildContacts(refreshed.data?.me?.contacts ?? []) }
    },
    [contacts, updateAlias, refetch],
  )

  const add = useCallback(async (): Promise<ContactListResult> => {
    throw unsupported("adding contacts")
  }, [])

  const remove = useCallback(async (): Promise<ContactListResult> => {
    throw unsupported("deleting contacts")
  }, [])

  const getTransactions = useCallback(
    async (_contactId: string): Promise<NormalizedTransaction[]> => [],
    [],
  )

  return {
    capabilities: {
      canAdd: false,
      canDelete: false,
      canEditPaymentIdentifier: false,
    },
    list,
    add,
    update,
    delete: remove,
    getTransactions,
    loading,
  }
}
