import { renderHook } from "@testing-library/react-native"

import { usePersonalDetailsData } from "@app/screens/card-screen/card-personal-details-screen/hooks/use-personal-details-data"

const mockUsePersonalDetailsQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  usePersonalDetailsQuery: (options: Record<string, unknown>) =>
    mockUsePersonalDetailsQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: {} }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

const withCards = (cards: { id: string; shippingAddress: null }[]) => ({
  data: {
    me: {
      id: "user-1",
      phone: "+15555555555",
      email: { address: "member@example.com" },
      defaultAccount: {
        id: "account-1",
        firstName: "John",
        lastName: "Doe",
        onboardingStatus: null,
        cards,
      },
    },
  },
  loading: false,
  error: undefined,
})

describe("usePersonalDetailsData", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /** The cardholder the KYC details are read from is the one behind the card on file. */
  it("names the card on file", () => {
    mockUsePersonalDetailsQuery.mockReturnValue(
      withCards([{ id: "card-1", shippingAddress: null }]),
    )

    const { result } = renderHook(() => usePersonalDetailsData())

    expect(result.current.cardId).toBe("card-1")
  })

  it("names no card for a member without one", () => {
    mockUsePersonalDetailsQuery.mockReturnValue(withCards([]))

    const { result } = renderHook(() => usePersonalDetailsData())

    expect(result.current.cardId).toBeUndefined()
  })
})
