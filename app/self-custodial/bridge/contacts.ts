import {
  type BreezSdkInterface,
  type Contact,
  type ListContactsRequest,
  type UpdateContactRequest,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import { normalizeString } from "@app/utils/helper"

const DEFAULT_CONTACTS_LIMIT = 100
const FIND_MAX_PAGES = 100

export const listContacts = (
  sdk: BreezSdkInterface,
  options?: Partial<ListContactsRequest>,
) =>
  sdk.listContacts({
    offset: options?.offset,
    limit: options?.limit ?? DEFAULT_CONTACTS_LIMIT,
  })

const fetchContactsPage = (
  sdk: BreezSdkInterface,
  page: number,
): Promise<ReadonlyArray<Contact>> =>
  listContacts(sdk, {
    offset: page * DEFAULT_CONTACTS_LIMIT,
    limit: DEFAULT_CONTACTS_LIMIT,
  })

const findContactByPaymentIdentifier = async (
  sdk: BreezSdkInterface,
  paymentIdentifier: string,
): Promise<Contact | undefined> => {
  const target = normalizeString(paymentIdentifier)
  const matchesTarget = (c: Contact) => normalizeString(c.paymentIdentifier) === target

  for (let page = 0; page < FIND_MAX_PAGES; page += 1) {
    const contacts = await fetchContactsPage(sdk, page)
    const match = contacts.find(matchesTarget)
    if (match) return match
    if (contacts.length < DEFAULT_CONTACTS_LIMIT) return undefined
  }

  reportError(
    "Contact lookup pagination",
    new Error(`Hit ${FIND_MAX_PAGES}-page safety cap`),
  )
  return undefined
}

export const FindOrCreateContactStatus = {
  Created: "created",
  Deduped: "deduped",
} as const

export type FindOrCreateContactStatus =
  (typeof FindOrCreateContactStatus)[keyof typeof FindOrCreateContactStatus]

export type FindOrCreateContactResult =
  | { status: typeof FindOrCreateContactStatus.Created; contact: Contact }
  | { status: typeof FindOrCreateContactStatus.Deduped; existing: Contact }

export const findOrCreateContact = async (
  sdk: BreezSdkInterface,
  paymentIdentifier: string,
  fallbackName: string,
): Promise<FindOrCreateContactResult> => {
  const existing = await findContactByPaymentIdentifier(sdk, paymentIdentifier)
  if (!existing) {
    const contact = await sdk.addContact({ name: fallbackName, paymentIdentifier })
    return { status: FindOrCreateContactStatus.Created, contact }
  }

  await sdk.updateContact({
    id: existing.id,
    name: existing.name,
    paymentIdentifier: existing.paymentIdentifier,
  })

  return { status: FindOrCreateContactStatus.Deduped, existing }
}

export const updateContact = (sdk: BreezSdkInterface, request: UpdateContactRequest) =>
  sdk.updateContact(request)

export const deleteContact = (sdk: BreezSdkInterface, id: string) => sdk.deleteContact(id)
