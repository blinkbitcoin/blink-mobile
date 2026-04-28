import React from "react"
import { render } from "@testing-library/react-native"

import { TemporarilyUnavailableScreen } from "@app/screens/feature-unavailable/temporarily-unavailable-screen"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = { warning: "#f90" }
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

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      FeatureUnavailable: {
        SelfCustodial: {
          title: () => "Temporarily unavailable",
          description: () => "Please try again later.",
        },
      },
    },
  }),
}))

describe("TemporarilyUnavailableScreen", () => {
  it("renders the title and description from i18n", () => {
    const { getByText, getByTestId } = render(<TemporarilyUnavailableScreen />)

    expect(getByTestId("temporarily-unavailable-screen")).toBeTruthy()
    expect(getByText("Temporarily unavailable")).toBeTruthy()
    expect(getByText("Please try again later.")).toBeTruthy()
  })
})
