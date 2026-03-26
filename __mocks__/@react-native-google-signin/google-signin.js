const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(() => Promise.resolve(true)),
  signIn: jest.fn(() => Promise.resolve({ idToken: "mock-id-token" })),
  getTokens: jest.fn(() =>
    Promise.resolve({ accessToken: "mock-access-token", idToken: "mock-id-token" }),
  ),
  signOut: jest.fn(() => Promise.resolve()),
  isSignedIn: jest.fn(() => Promise.resolve(false)),
}

const statusCodes = {
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  IN_PROGRESS: "IN_PROGRESS",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
}

module.exports = { GoogleSignin, statusCodes }
