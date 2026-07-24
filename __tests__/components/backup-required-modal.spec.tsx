import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { BackupRequiredModal } from "@app/components/backup-required-modal"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

const mockGaloyIcon = jest.fn<null, [Record<string, unknown>]>(() => null)

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: (props: Record<string, unknown>) => {
    mockGaloyIcon(props)
    return React.createElement("View", { testID: `galoy-icon-${props.name}` })
  },
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "backup-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: () => null,
}))

jest.mock("react-native-modal", () => {
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? React.createElement("View", { testID: "modal" }, children) : null)
  MockModal.displayName = "MockModal"
  return MockModal
})

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupRequired: {
        modalTitle: () => "Back up your wallet first",
        modalDescription: () =>
          "Your Lightning address is permanently linked to this wallet. Back up your recovery phrase first, so you never lose access to your address and funds.",
        backupNow: () => "Back up wallet",
      },
    },
  }),
}))

describe("BackupRequiredModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders when visible", () => {
    const { getByTestId } = render(
      <BackupRequiredModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByTestId("modal")).toBeTruthy()
  })

  it("does not render when not visible", () => {
    const { queryByTestId } = render(
      <BackupRequiredModal isVisible={false} onClose={jest.fn()} />,
    )

    expect(queryByTestId("modal")).toBeNull()
  })

  it("renders title and description", () => {
    const { getByText } = render(
      <BackupRequiredModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByText("Back up your wallet first")).toBeTruthy()
    expect(
      getByText(
        "Your Lightning address is permanently linked to this wallet. Back up your recovery phrase first, so you never lose access to your address and funds.",
      ),
    ).toBeTruthy()
  })

  it("renders back up wallet button", () => {
    const { getByText } = render(
      <BackupRequiredModal isVisible={true} onClose={jest.fn()} />,
    )

    expect(getByText("Back up wallet")).toBeTruthy()
  })

  it("navigates to backup method screen and closes on button press", () => {
    const onClose = jest.fn()
    const { getByTestId } = render(
      <BackupRequiredModal isVisible={true} onClose={onClose} />,
    )

    fireEvent.press(getByTestId("backup-button"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupMethod")
    // the modal must be dismissed before the backup screen is pushed
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    )
  })

  it("closes without navigating when dismissed via the close icon", () => {
    const onClose = jest.fn()
    const { getByTestId } = render(
      <BackupRequiredModal isVisible={true} onClose={onClose} />,
    )

    fireEvent.press(getByTestId("galoy-icon-close"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("uses primary color for warning icon", () => {
    render(<BackupRequiredModal isVisible={true} onClose={jest.fn()} />)

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "warning",
        size: 52,
        color: "#fc5805",
      }),
    )
  })
})
