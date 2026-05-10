import {
  type BreezSdkInterface,
  type Contact,
  type ListContactsRequest,
  type UpdateContactRequest,
} from "@breeztech/breez-sdk-spark-react-native"

import { normalizeString } from "@app/utils/helper"

const DEFAULT_CONTACTS_LIMIT = 100

export const listContacts = (
  sdk: BreezSdkInterface,
  options?: Partial<ListContactsRequest>,
) =>
  sdk.listContacts({
    offset: options?.offset,
    limit: options?.limit ?? DEFAULT_CONTACTS_LIMIT,
  })

const findContactByPaymentIdentifier = async (
  sdk: BreezSdkInterface,
  paymentIdentifier: string,
): Promise<Contact | undefined> => {
  const target = normalizeString(paymentIdentifier)
  const contacts = await listContacts(sdk)
  return contacts.find((c) => normalizeString(c.paymentIdentifier) === target)
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
