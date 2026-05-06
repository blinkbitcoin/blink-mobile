import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
} from "@app/self-custodial/bridge/contacts"

const createMockSdk = () => ({
  listContacts: jest.fn().mockResolvedValue([]),
  addContact: jest.fn().mockResolvedValue({
    id: "new",
    name: "Alice",
    paymentIdentifier: "alice@blink.sv",
  }),
  updateContact: jest.fn().mockImplementation(async (req) => ({ ...req })),
  deleteContact: jest.fn().mockResolvedValue(undefined),
})

describe("listContacts", () => {
  it("uses the default limit of 100 and undefined offset when no options are passed", () => {
    const sdk = createMockSdk()
    listContacts(sdk as never)
    expect(sdk.listContacts).toHaveBeenCalledWith({ offset: undefined, limit: 100 })
  })

  it("passes through the caller's offset and limit when provided", () => {
    const sdk = createMockSdk()
    listContacts(sdk as never, { offset: 50, limit: 25 })
    expect(sdk.listContacts).toHaveBeenCalledWith({ offset: 50, limit: 25 })
  })

  it("falls back to the default limit when only offset is passed", () => {
    const sdk = createMockSdk()
    listContacts(sdk as never, { offset: 10 })
    expect(sdk.listContacts).toHaveBeenCalledWith({ offset: 10, limit: 100 })
  })
})

describe("addContact", () => {
  it("creates the contact when no existing one shares the payment identifier", async () => {
    const sdk = createMockSdk()
    const request = { name: "Alice", paymentIdentifier: "alice@blink.sv" }

    const result = await addContact(sdk as never, request as never)

    expect(sdk.addContact).toHaveBeenCalledWith(request)
    expect(result).toEqual({
      id: "new",
      name: "Alice",
      paymentIdentifier: "alice@blink.sv",
    })
  })

  it("touches the existing contact via update so its updatedAt bumps, instead of creating a duplicate", async () => {
    const sdk = createMockSdk()
    const existing = {
      id: "c1",
      name: "Alice",
      paymentIdentifier: "alice@blink.sv",
    }
    sdk.listContacts.mockResolvedValueOnce([existing])

    await addContact(
      sdk as never,
      {
        name: "Alice (paid)",
        paymentIdentifier: "alice@blink.sv",
      } as never,
    )

    expect(sdk.addContact).not.toHaveBeenCalled()
    expect(sdk.updateContact).toHaveBeenCalledWith({
      id: existing.id,
      name: existing.name,
      paymentIdentifier: existing.paymentIdentifier,
    })
  })

  it("preserves the existing name when touching a duplicate (does not overwrite user edits)", async () => {
    const sdk = createMockSdk()
    const existing = {
      id: "c1",
      name: "Alice (custom)",
      paymentIdentifier: "alice@blink.sv",
    }
    sdk.listContacts.mockResolvedValueOnce([existing])

    await addContact(
      sdk as never,
      {
        name: "alice@blink.sv",
        paymentIdentifier: "alice@blink.sv",
      } as never,
    )

    expect(sdk.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alice (custom)" }),
    )
  })

  it("matches existing contacts case-insensitively and ignoring whitespace", async () => {
    const sdk = createMockSdk()
    const existing = {
      id: "c1",
      name: "Alice",
      paymentIdentifier: "Alice@Blink.sv",
    }
    sdk.listContacts.mockResolvedValueOnce([existing])

    await addContact(
      sdk as never,
      {
        name: "Alice",
        paymentIdentifier: "  alice@blink.sv  ",
      } as never,
    )

    expect(sdk.addContact).not.toHaveBeenCalled()
    expect(sdk.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", paymentIdentifier: "Alice@Blink.sv" }),
    )
  })

  it("creates the contact when the existing list has no matching identifier", async () => {
    const sdk = createMockSdk()
    sdk.listContacts.mockResolvedValueOnce([
      { id: "c1", name: "Bob", paymentIdentifier: "bob@blink.sv" },
    ])

    await addContact(
      sdk as never,
      {
        name: "Alice",
        paymentIdentifier: "alice@blink.sv",
      } as never,
    )

    expect(sdk.addContact).toHaveBeenCalledTimes(1)
  })
})

describe("updateContact", () => {
  it("forwards the request to the SDK", () => {
    const sdk = createMockSdk()
    const request = { id: "c1", name: "Bob" }
    updateContact(sdk as never, request as never)
    expect(sdk.updateContact).toHaveBeenCalledWith(request)
  })
})

describe("deleteContact", () => {
  it("forwards the contact id to the SDK", () => {
    const sdk = createMockSdk()
    deleteContact(sdk as never, "c1")
    expect(sdk.deleteContact).toHaveBeenCalledWith("c1")
  })
})
