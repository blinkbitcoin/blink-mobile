import {
  ContactChangeStep,
  ContactField,
  contactFieldOf,
  contactRemoveStepOf,
} from "@app/types/two-factor-enforcement"

describe("contactFieldOf", () => {
  const cases = [
    [ContactChangeStep.EmailRemove, ContactField.Email],
    [ContactChangeStep.EmailAdd, ContactField.Email],
    [ContactChangeStep.EmailReverify, ContactField.Email],
    [ContactChangeStep.PhoneRemove, ContactField.Phone],
    [ContactChangeStep.PhoneAdd, ContactField.Phone],
  ] as const

  for (const [step, field] of cases) {
    it(`names ${field} for ${step}`, () => {
      expect(contactFieldOf(step)).toBe(field)
    })
  }
})

describe("contactRemoveStepOf", () => {
  it("begins an email change by removing the email", () => {
    expect(contactRemoveStepOf(ContactField.Email)).toBe(ContactChangeStep.EmailRemove)
  })

  it("begins a phone change by removing the phone number", () => {
    expect(contactRemoveStepOf(ContactField.Phone)).toBe(ContactChangeStep.PhoneRemove)
  })
})
