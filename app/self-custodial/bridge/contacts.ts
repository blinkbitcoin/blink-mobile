import {
  type AddContactRequest,
  type BreezSdkInterface,
  type ListContactsRequest,
  type UpdateContactRequest,
} from "@breeztech/breez-sdk-spark-react-native"

const DEFAULT_CONTACTS_LIMIT = 100

export const listContacts = (
  sdk: BreezSdkInterface,
  options?: Partial<ListContactsRequest>,
) =>
  sdk.listContacts({
    offset: options?.offset,
    limit: options?.limit ?? DEFAULT_CONTACTS_LIMIT,
  })

export const addContact = (sdk: BreezSdkInterface, request: AddContactRequest) =>
  sdk.addContact(request)

export const updateContact = (sdk: BreezSdkInterface, request: UpdateContactRequest) =>
  sdk.updateContact(request)

export const deleteContact = (sdk: BreezSdkInterface, id: string) => sdk.deleteContact(id)
