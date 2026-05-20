import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
} from "@app/self-custodial/bridge/contacts"

const createMockSdk = () => ({
  listContacts: jest.fn().mockResolvedValue({ contacts: [] }),
  addContact: jest.fn().mockResolvedValue(undefined),
  updateContact: jest.fn().mockResolvedValue(undefined),
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
  it("forwards the request to the SDK", () => {
    const sdk = createMockSdk()
    const request = { name: "Alice", paymentIdentifier: "alice@blink.sv" }
    addContact(sdk as never, request as never)
    expect(sdk.addContact).toHaveBeenCalledWith(request)
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
