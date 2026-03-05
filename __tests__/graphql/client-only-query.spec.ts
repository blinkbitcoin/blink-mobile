import {
  PreferredAmountCurrency,
  savePreferredAmountCurrency,
} from "@app/graphql/client-only-query"
import { PreferredAmountCurrencyDocument } from "@app/graphql/generated"

type ClientArg = Parameters<typeof savePreferredAmountCurrency>[0]

const createMockClient = (writeQueryImpl?: ClientArg["writeQuery"]) => {
  const client = {
    writeQuery: writeQueryImpl ?? jest.fn(),
  } as ClientArg
  return client
}

describe("PreferredAmountCurrency", () => {
  it("Display is 'display'", () => {
    expect(PreferredAmountCurrency.Display).toBe("display")
  })

  it("Default is 'default'", () => {
    expect(PreferredAmountCurrency.Default).toBe("default")
  })
})

describe("savePreferredAmountCurrency", () => {
  it("writes Display preference and returns it", () => {
    const client = createMockClient()
    const result = savePreferredAmountCurrency(client, PreferredAmountCurrency.Display)

    expect(result).toBe(PreferredAmountCurrency.Display)
    expect(client.writeQuery).toHaveBeenCalledTimes(1)
  })

  it("writes Default preference and returns it", () => {
    const client = createMockClient()
    const result = savePreferredAmountCurrency(client, PreferredAmountCurrency.Default)

    expect(result).toBe(PreferredAmountCurrency.Default)
    expect(client.writeQuery).toHaveBeenCalledTimes(1)
  })

  it("returns null when writeQuery throws", () => {
    const client = createMockClient(() => {
      throw new Error("cache error")
    })
    const result = savePreferredAmountCurrency(client, PreferredAmountCurrency.Display)

    expect(result).toBeNull()
  })

  it("passes PreferredAmountCurrencyDocument as query arg", () => {
    const client = createMockClient()
    savePreferredAmountCurrency(client, PreferredAmountCurrency.Display)

    expect(client.writeQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: PreferredAmountCurrencyDocument }),
    )
  })
})
