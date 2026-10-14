import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

import { BackendFeatureGate } from "@app/components/backend-feature-gate/backend-feature-gate"
import { BlinkServicesStatus } from "@app/graphql/blink-services-status"

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
const mockUseActiveWallet = jest.fn()
const mockUseBlinkServicesStatus = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => mockUseHasCustodialAccount(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/graphql/blink-services-status", () => ({
  ...jest.requireActual("@app/graphql/blink-services-status"),
  useBlinkServicesStatus: () => mockUseBlinkServicesStatus(),
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
        unreachableTitle: () => "Blink is unreachable",
        unreachableDescription: ({ featureName }: { featureName: string }) =>
          `${featureName} needs Blink's servers`,
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
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
    mockUseBlinkServicesStatus.mockReturnValue(BlinkServicesStatus.Reachable)
  })

  it("renders the gated children when the user is authenticated and on a custodial account", () => {
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

  it("blocks the gated children when the active account is self-custodial, even with a saved custodial token", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHasCustodialAccount.mockReturnValue(true)
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })

    const { queryByTestId, getByText } = renderGate()

    expect(queryByTestId("children")).toBeNull()
    expect(queryByTestId("backend-feature-gate")).toBeTruthy()
    expect(getByText("Sign in to continue")).toBeTruthy()
  })
  describe("when Blink is not answering", () => {
    beforeEach(() => {
      mockUseBlinkServicesStatus.mockReturnValue(BlinkServicesStatus.Unreachable)
    })

    it("explains the outage to a session that is otherwise entitled to the feature", () => {
      mockUseIsAuthed.mockReturnValue(true)
      mockUseHasCustodialAccount.mockReturnValue(true)

      const { queryByTestId, getByText } = renderGate()

      // Without this the user watches the feature try and fail with no reason given.
      expect(queryByTestId("children")).toBeNull()
      expect(getByText("Blink is unreachable")).toBeTruthy()
      expect(getByText("Cards needs Blink's servers")).toBeTruthy()
    })

    it("still names the durable reason first for a user with no custodial account", () => {
      // "Create an account" stays true when the servers come back; the outage does not.
      mockUseIsAuthed.mockReturnValue(false)
      mockUseHasCustodialAccount.mockReturnValue(false)

      const { getByText, queryByText } = renderGate()

      expect(getByText("Create an account")).toBeTruthy()
      expect(queryByText("Blink is unreachable")).toBeNull()
    })

    it("still names the sign-in reason first for a signed-out user", () => {
      mockUseIsAuthed.mockReturnValue(false)
      mockUseHasCustodialAccount.mockReturnValue(true)

      const { getByText, queryByText } = renderGate()

      expect(getByText("Sign in to continue")).toBeTruthy()
      expect(queryByText("Blink is unreachable")).toBeNull()
    })
  })

  it("renders the children while the status is still Unknown", () => {
    // Nothing has been attempted yet; blocking on that would gate every cold start.
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHasCustodialAccount.mockReturnValue(true)
    mockUseBlinkServicesStatus.mockReturnValue(BlinkServicesStatus.Unknown)

    const { getByTestId } = renderGate()

    expect(getByTestId("children")).toBeTruthy()
  })
})
