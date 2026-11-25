import { ApolloClient, InMemoryCache } from "@apollo/client"
import { MockLink, MockedResponse } from "@apollo/client/testing"
import { GraphQLError } from "graphql"

import { CardProvisioningDataDocument } from "@app/graphql/generated"
import { fetchCardProvisioningData } from "@app/screens/card-screen/utils/card-provisioning-data"

type AddressAnswer = {
  __typename: "CardholderAddress"
  name: string
  line1: string
  line2: string | null
  city: string
  region: string
  postalCode: string
  countryCode: string
  phoneNumber: string | null
}

const blinkCardAddress: AddressAnswer = {
  __typename: "CardholderAddress",
  name: "Satoshi Nakamoto",
  line1: "1 Main St",
  line2: "Apt 2",
  city: "San Salvador",
  region: "SS",
  postalCode: "1101",
  countryCode: "SV",
  phoneNumber: "+50370000000",
}

const answered = (cardholderAddress: AddressAnswer | null): MockedResponse => ({
  request: { query: CardProvisioningDataDocument, variables: { cardId: "card-1" } },
  result: {
    data: {
      cardProvisioningData: {
        __typename: "CardProvisioningData",
        processorCardId: "processor-1",
        cardSecret: "secret-1",
        displayName: "SATOSHI NAKAMOTO",
        cardholderAddress,
      },
    },
  },
})

const clientAnswering = (response: MockedResponse) =>
  new ApolloClient({ cache: new InMemoryCache(), link: new MockLink([response]) })

describe("fetchCardProvisioningData", () => {
  it("hands over what the wallet needs, with the card as Rain's processor knows it", async () => {
    const client = clientAnswering(answered(blinkCardAddress))

    await expect(fetchCardProvisioningData(client, "card-1")).resolves.toEqual({
      processorCardId: "processor-1",
      cardSecret: "secret-1",
      displayName: "SATOSHI NAKAMOTO",
      address: {
        name: "Satoshi Nakamoto",
        line1: "1 Main St",
        line2: "Apt 2",
        city: "San Salvador",
        region: "SS",
        postalCode: "1101",
        countryCode: "SV",
        phoneNumber: "+50370000000",
      },
    })
  })

  it("hands over no address when Rain has none for the cardholder", async () => {
    const client = clientAnswering(answered(null))

    const data = await fetchCardProvisioningData(client, "card-1")

    expect(data.address).toBeUndefined()
  })

  it("reads a missing second line as empty and a missing phone as none", async () => {
    const client = clientAnswering(
      answered({ ...blinkCardAddress, line2: null, phoneNumber: null }),
    )

    const { address } = await fetchCardProvisioningData(client, "card-1")

    expect(address?.line2).toBe("")
    expect(address?.phoneNumber).toBeUndefined()
  })

  it("keeps the card secret out of the cache", async () => {
    const client = clientAnswering(answered(blinkCardAddress))

    await fetchCardProvisioningData(client, "card-1")

    expect(JSON.stringify(client.cache.extract())).not.toContain("secret-1")
  })

  it("fails when blink-card refuses the card", async () => {
    const client = clientAnswering({
      request: { query: CardProvisioningDataDocument, variables: { cardId: "card-1" } },
      result: { errors: [new GraphQLError("Card not found")] },
    })

    await expect(fetchCardProvisioningData(client, "card-1")).rejects.toThrow(
      "Card not found",
    )
  })
})
