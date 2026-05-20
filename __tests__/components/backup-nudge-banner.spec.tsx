import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { BackupNudgeBanner } from "@app/components/backup-nudge-banner"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#007",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "dismiss-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "cta-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupNudge: {
        title: () => "Your funds are at risk",
        description: () => "Secure your wallet now. It only takes a minute.",
        cta: () => "Secure wallet",
      },
    },
  }),
}))

describe("BackupNudgeBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and description", () => {
    const { getByText } = render(<BackupNudgeBanner onDismiss={jest.fn()} />)

    expect(getByText("Your funds are at risk")).toBeTruthy()
    expect(getByText("Secure your wallet now. It only takes a minute.")).toBeTruthy()
  })

  it("renders CTA button with correct label", () => {
    const { getByText } = render(<BackupNudgeBanner onDismiss={jest.fn()} />)

    expect(getByText("Secure wallet")).toBeTruthy()
  })

  it("calls onDismiss when dismiss button pressed", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(<BackupNudgeBanner onDismiss={onDismiss} />)

    fireEvent.press(getByTestId("dismiss-button"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("navigates to backup method screen on CTA press", () => {
    const { getByTestId } = render(<BackupNudgeBanner onDismiss={jest.fn()} />)

    fireEvent.press(getByTestId("cta-button"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
  })
})
