import { NormalizedTransaction } from "./transaction.types"
import { AccountType } from "./wallet.types"

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
  getTransactions: (contactId: string) => Promise<NormalizedTransaction[]>
}
