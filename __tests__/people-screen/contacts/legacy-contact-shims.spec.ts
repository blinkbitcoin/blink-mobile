import { AccountType } from "@app/types/wallet.types"

import {
  sdkContactToUserContact,
  unifiedContactToUserContact,
} from "@app/screens/people-screen/contacts/legacy-contact-shims"

describe("unifiedContactToUserContact", () => {
  it("maps a unified Contact into the legacy GraphQL UserContact shape", () => {
    const result = unifiedContactToUserContact({
      id: "c1",
      displayName: "Alice",
      paymentIdentifier: "alice@blink.sv",
      transactionsCount: 7,
      sourceAccountType: AccountType.Custodial,
    })

    expect(result).toEqual({
      __typename: "UserContact",
      id: "c1",
      handle: "alice@blink.sv",
      username: "alice@blink.sv",
      alias: "Alice",
      transactionsCount: 7,
    })
  })
})

describe("sdkContactToUserContact", () => {
  it("maps an SDK Contact into the legacy GraphQL UserContact shape", () => {
    const result = sdkContactToUserContact({
      id: "sdk1",
      name: "Bob",
      paymentIdentifier: "bob@example.com",
    } as never)

    expect(result).toEqual({
      __typename: "UserContact",
      id: "sdk1",
      handle: "bob@example.com",
      username: "bob@example.com",
      alias: "Bob",
      transactionsCount: 0,
    })
  })
})
