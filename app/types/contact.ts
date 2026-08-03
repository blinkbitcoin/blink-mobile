import { NormalizedTransaction } from "./transaction"
import { AccountType } from "./wallet"

export type Contact = {
  id: string
  displayName: string
  paymentIdentifier: string
  transactionsCount: number
  sourceAccountType: AccountType
}

export type ContactCapabilities = {
  canAdd: boolean
  canDelete: boolean
  canEditPaymentIdentifier: boolean
}

export type ContactListResult = {
  contacts: Contact[]
  errors?: Array<{ message: string }>
}

/**
 * One page of a contact's transactions. `nextCursor` is opaque to the caller: it hands
 * back whatever it received to ask for the following page, and `null` means the history
 * is exhausted. Keeping it opaque lets each adapter page the way its source allows
 * without the screen knowing whether that is an SDK offset or a backend cursor.
 */
export type ContactTransactionsPage = {
  transactions: NormalizedTransaction[]
  nextCursor: string | null
}

export type ContactAdapter = {
  capabilities: ContactCapabilities
  list: () => Promise<ContactListResult>
  add: (
    contact: Omit<Contact, "id" | "transactionsCount" | "sourceAccountType">,
  ) => Promise<ContactListResult>
  update: (
    id: string,
    contact: Partial<Omit<Contact, "id" | "sourceAccountType">>,
  ) => Promise<ContactListResult>
  delete: (id: string) => Promise<ContactListResult>
  /**
   * Keyed by payment identifier rather than contact id: it is what a payment carries, so
   * an adapter never has to resolve its own contact list first just to answer.
   */
  getTransactions: (
    paymentIdentifier: string,
    cursor?: string | null,
  ) => Promise<ContactTransactionsPage>
}
