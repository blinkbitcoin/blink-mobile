import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { BackendFeatureGate } from "@app/components/backend-feature-gate/backend-feature-gate"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = { primary: "#007", grey2: "#999" }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("Screen", null, children),
}))

const mockUseIsAuthed = jest.fn()
const mockUseHasCustodialAccount = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockUseHasCustodialAccount(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackendFeatureGate: {
        signInTitle: () => "Sign in to continue",
        signInDescription: ({ featureName }: { featureName: string }) =>
          `Sign in to use ${featureName}`,
        noAccountTitle: () => "Create an account",
        noAccountDescription: ({ featureName }: { featureName: string }) =>
          `Create an account to use ${featureName}`,
      },
    },
  }),
}))

const renderGate = () =>
  render(
    <BackendFeatureGate featureName="Cards" icon={<Text>icon</Text>}>
      <Text testID="children">protected content</Text>
    </BackendFeatureGate>,
  )

describe("BackendFeatureGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the gated children when the user is authenticated", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHasCustodialAccount.mockReturnValue(false)

    const { getByTestId, queryByTestId } = renderGate()

    expect(getByTestId("children")).toBeTruthy()
    expect(queryByTestId("backend-feature-gate")).toBeNull()
  })

  it("renders the sign-in copy when the user has a custodial account but is signed out", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseHasCustodialAccount.mockReturnValue(true)

    const { getByText, queryByTestId } = renderGate()

    expect(queryByTestId("backend-feature-gate")).toBeTruthy()
    expect(getByText("Sign in to continue")).toBeTruthy()
    expect(getByText("Sign in to use Cards")).toBeTruthy()
  })

  it("renders the create-account copy when the user has no custodial account", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseHasCustodialAccount.mockReturnValue(false)

    const { getByText } = renderGate()

    expect(getByText("Create an account")).toBeTruthy()
    expect(getByText("Create an account to use Cards")).toBeTruthy()
  })
})
