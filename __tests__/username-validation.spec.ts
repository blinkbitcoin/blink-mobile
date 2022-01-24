import { UsernameValidation } from "../app/utils/validation"

describe("Username validation", () => {
  it("is invalid for an empty username", () => {
    const username = ""

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeFalsy()
    expect(hasValidCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a short username", () => {
    const username = "ab"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeFalsy()
    expect(hasValidCharacters).toBeTruthy()
    expect(isValid).toBeFalsy()
  })

  it("is valid for a normal username", () => {
    const username = "Bitcoin"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(isValid).toBeTruthy()
  })

  it("is valid for a username with an _", () => {
    const username = "Bit_Coin"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(isValid).toBeTruthy()
  })

  it("is invalid for a username with a .", () => {
    const username = "Bit.Coin"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a username with a :", () => {
    const username = "Bitcoin:"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a username beginning with bc1", () => {
    const username = "bc1hello"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const hasNoRestictedStartCharacters =
      UsernameValidation.hasNoRestictedStartCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(hasNoRestictedStartCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a username beginning with 1", () => {
    const username = "1hello"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const hasNoRestictedStartCharacters =
      UsernameValidation.hasNoRestictedStartCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(hasNoRestictedStartCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a username beginning with 3", () => {
    const username = "3hello"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const hasNoRestictedStartCharacters =
      UsernameValidation.hasNoRestictedStartCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(hasNoRestictedStartCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })

  it("is invalid for a username beginning with lnbc1", () => {
    const username = "lnbc1ps7fqhwpp5"

    const hasValidLength = UsernameValidation.hasValidLength(username)
    const hasValidCharacters = UsernameValidation.hasValidCharacters(username)
    const hasNoRestictedStartCharacters =
      UsernameValidation.hasNoRestictedStartCharacters(username)
    const isValid = UsernameValidation.isValid(username)

    expect(hasValidLength).toBeTruthy()
    expect(hasValidCharacters).toBeTruthy()
    expect(hasNoRestictedStartCharacters).toBeFalsy()
    expect(isValid).toBeFalsy()
  })
})
