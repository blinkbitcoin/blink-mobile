import {
  type AddContactRequest,
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

export const addContact = async (
  sdk: BreezSdkInterface,
  request: AddContactRequest,
): Promise<Contact> => {
  const existing = await findContactByPaymentIdentifier(sdk, request.paymentIdentifier)
  if (!existing) return sdk.addContact(request)
  return sdk.updateContact({
    id: existing.id,
    name: existing.name,
    paymentIdentifier: existing.paymentIdentifier,
  })
}

export const updateContact = (sdk: BreezSdkInterface, request: UpdateContactRequest) =>
  sdk.updateContact(request)

export const deleteContact = (sdk: BreezSdkInterface, id: string) => sdk.deleteContact(id)
