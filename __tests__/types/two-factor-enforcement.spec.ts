import {
  LoginMethod,
  LoginMethodAddition,
  loginMethodOf,
} from "@app/types/two-factor-enforcement"

describe("loginMethodOf", () => {
  const cases = [
    [LoginMethodAddition.Email, LoginMethod.Email],
    [LoginMethodAddition.EmailReverify, LoginMethod.Email],
    [LoginMethodAddition.Phone, LoginMethod.Phone],
  ] as const

  for (const [addition, loginMethod] of cases) {
    it(`names ${loginMethod} for ${addition}`, () => {
      expect(loginMethodOf(addition)).toBe(loginMethod)
    })
  }
})
