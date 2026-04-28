import { type Contact as SdkContact } from "@breeztech/breez-sdk-spark-react-native"

import { UserContact } from "@app/graphql/generated"
import { type Contact } from "@app/types/contact.types"

export const unifiedContactToUserContact = (contact: Contact): UserContact => ({
  __typename: "UserContact",
  id: contact.id,
  handle: contact.paymentIdentifier,
  username: contact.paymentIdentifier,
  alias: contact.displayName,
  transactionsCount: contact.transactionsCount,
})

export const sdkContactToUserContact = (contact: SdkContact): UserContact => ({
  __typename: "UserContact",
  id: contact.id,
  handle: contact.paymentIdentifier,
  username: contact.paymentIdentifier,
  alias: contact.name,
  transactionsCount: 0,
})
