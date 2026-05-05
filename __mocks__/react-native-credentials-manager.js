const signUpWithPassword = jest.fn(() =>
  Promise.resolve({ type: "password", success: true }),
)

const signIn = jest.fn(() =>
  Promise.resolve({
    type: "password",
    username: "mock-username",
    password: "mock-password",
  }),
)

const signUpWithPasskeys = jest.fn(() => Promise.resolve({}))
const signUpWithGoogle = jest.fn(() => Promise.resolve({}))
const signUpWithApple = jest.fn(() => Promise.resolve({}))
const signOut = jest.fn(() => Promise.resolve(null))

export {
  signIn,
  signOut,
  signUpWithApple,
  signUpWithGoogle,
  signUpWithPasskeys,
  signUpWithPassword,
}
