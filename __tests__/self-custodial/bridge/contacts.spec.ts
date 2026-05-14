const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

import {
  deleteContact,
  findOrCreateContact,
  FindOrCreateContactStatus,
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

describe("findOrCreateContact", () => {
  it("returns status='created' with the new contact when no existing one shares the payment identifier", async () => {
    const sdk = createMockSdk()

    const result = await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.addContact).toHaveBeenCalledWith({
      name: "Alice",
      paymentIdentifier: "alice@blink.sv",
    })
    expect(result).toEqual({
      status: FindOrCreateContactStatus.Created,
      contact: {
        id: "new",
        name: "Alice",
        paymentIdentifier: "alice@blink.sv",
      },
    })
  })

  it("returns status='deduped' with the existing contact when the payment identifier already exists", async () => {
    const sdk = createMockSdk()
    const existing = {
      id: "c1",
      name: "Alice",
      paymentIdentifier: "alice@blink.sv",
    }
    sdk.listContacts.mockResolvedValueOnce([existing])

    const result = await findOrCreateContact(
      sdk as never,
      "alice@blink.sv",
      "Alice (paid)",
    )

    expect(result).toEqual({ status: FindOrCreateContactStatus.Deduped, existing })
    expect(sdk.addContact).not.toHaveBeenCalled()
  })

  it("bumps existing.updatedAt via updateContact without overwriting the stored name", async () => {
    const sdk = createMockSdk()
    const existing = {
      id: "c1",
      name: "Alice (custom)",
      paymentIdentifier: "alice@blink.sv",
    }
    sdk.listContacts.mockResolvedValueOnce([existing])

    await findOrCreateContact(sdk as never, "alice@blink.sv", "alice@blink.sv")

    expect(sdk.updateContact).toHaveBeenCalledWith({
      id: existing.id,
      name: existing.name,
      paymentIdentifier: existing.paymentIdentifier,
    })
    expect(sdk.updateContact).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "alice@blink.sv" }),
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

    const result = await findOrCreateContact(sdk as never, "  alice@blink.sv  ", "Alice")

    expect(sdk.addContact).not.toHaveBeenCalled()
    expect(result).toEqual({ status: FindOrCreateContactStatus.Deduped, existing })
    expect(sdk.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", paymentIdentifier: "Alice@Blink.sv" }),
    )
  })

  it("returns status='created' when the existing list has no matching identifier", async () => {
    const sdk = createMockSdk()
    sdk.listContacts.mockResolvedValueOnce([
      { id: "c1", name: "Bob", paymentIdentifier: "bob@blink.sv" },
    ])

    const result = await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.addContact).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(FindOrCreateContactStatus.Created)
  })

  it("paginates beyond the first 100 contacts to find a match past the page boundary", async () => {
    const sdk = createMockSdk()
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      name: `Contact ${i}`,
      paymentIdentifier: `contact${i}@blink.sv`,
    }))
    const matchOnSecondPage = {
      id: "c150",
      name: "Alice",
      paymentIdentifier: "alice@blink.sv",
    }
    sdk.listContacts
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([matchOnSecondPage])

    const result = await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.listContacts).toHaveBeenCalledWith({ offset: 0, limit: 100 })
    expect(sdk.listContacts).toHaveBeenCalledWith({ offset: 100, limit: 100 })
    expect(sdk.addContact).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: FindOrCreateContactStatus.Deduped,
      existing: matchOnSecondPage,
    })
  })

  it("stops paginating once a page returns fewer than 100 entries", async () => {
    const sdk = createMockSdk()
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      name: `Contact ${i}`,
      paymentIdentifier: `contact${i}@blink.sv`,
    }))
    const partialSecondPage = Array.from({ length: 30 }, (_, i) => ({
      id: `c${100 + i}`,
      name: `Contact ${100 + i}`,
      paymentIdentifier: `contact${100 + i}@blink.sv`,
    }))
    sdk.listContacts
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(partialSecondPage)

    await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.listContacts).toHaveBeenCalledTimes(2)
    expect(sdk.addContact).toHaveBeenCalledTimes(1)
  })

  it("does not page past the first call when the first page is short", async () => {
    const sdk = createMockSdk()
    sdk.listContacts.mockResolvedValueOnce([
      { id: "c1", name: "Bob", paymentIdentifier: "bob@blink.sv" },
    ])

    await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.listContacts).toHaveBeenCalledTimes(1)
  })

  it("caps the pagination at 100 pages so a pathological list cannot loop forever", async () => {
    const sdk = createMockSdk()
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      name: `Contact ${i}`,
      paymentIdentifier: `contact${i}@blink.sv`,
    }))
    sdk.listContacts.mockResolvedValue(fullPage)

    await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(sdk.listContacts).toHaveBeenCalledTimes(100)
  })

  it("reports to crashlytics when the page cap is reached so SDK pagination bugs are observable", async () => {
    const sdk = createMockSdk()
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      name: `Contact ${i}`,
      paymentIdentifier: `contact${i}@blink.sv`,
    }))
    sdk.listContacts.mockResolvedValue(fullPage)

    await findOrCreateContact(sdk as never, "alice@blink.sv", "Alice")

    expect(mockRecordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("safety cap"),
      }),
    )
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
