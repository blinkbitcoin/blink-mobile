import React from "react"

import { Platform } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"

import CustomModal from "@app/components/custom-modal/custom-modal"

let mockThemeMode = "light"

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey5: "#f5f5f5",
    white: "#fff",
    black: "#000",
  }
  const Text = ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children)
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text,
    useTheme: () => ({ theme: { colors, mode: mockThemeMode } }),
  }
})

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
    onBackdropPress,
    onBackButtonPress,
  }: {
    children: React.ReactNode
    isVisible: boolean
    onBackdropPress?: () => void
    onBackButtonPress?: () => void
  }) =>
    isVisible
      ? ReactNs.createElement(
          RN.View,
          { testID: "modal" },
          ReactNs.createElement(RN.Pressable, {
            testID: "backdrop",
            onPress: onBackdropPress,
          }),
          ReactNs.createElement(RN.Pressable, {
            testID: "back-button",
            onPress: onBackButtonPress,
          }),
          children,
        )
      : null
  MockModal.displayName = "MockModal"
  return MockModal
})

jest.mock("react-native-gesture-handler", () => {
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return { ScrollView: RN.View }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) =>
    React.createElement("View", { testID: `icon-${name}` }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement("Pressable", { onPress, testID: `primary-${title}` }),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement("Pressable", { onPress, testID: `secondary-${title}` }),
}))

const baseProps = {
  isVisible: true,
  body: null,
  primaryButtonTitle: "OK",
  primaryButtonOnPress: jest.fn(),
}

describe("CustomModal", () => {
  beforeEach(() => {
    mockThemeMode = "light"
  })

  it("does not render when invisible", () => {
    const { queryByTestId } = render(
      <CustomModal {...baseProps} isVisible={false} toggleModal={jest.fn()} />,
    )
    expect(queryByTestId("modal")).toBeNull()
  })

  it("closes on backdrop press by default", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = render(
      <CustomModal {...baseProps} toggleModal={toggleModal} />,
    )

    fireEvent.press(getByTestId("backdrop"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("does not close on backdrop press when not dismissable", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = render(
      <CustomModal {...baseProps} toggleModal={toggleModal} dismissable={false} />,
    )

    fireEvent.press(getByTestId("backdrop"))

    expect(toggleModal).not.toHaveBeenCalled()
  })

  it("closes on the Android back button by default", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = render(
      <CustomModal {...baseProps} toggleModal={toggleModal} />,
    )

    fireEvent.press(getByTestId("back-button"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("ignores the Android back button when not dismissable", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = render(
      <CustomModal {...baseProps} toggleModal={toggleModal} dismissable={false} />,
    )

    fireEvent.press(getByTestId("back-button"))

    expect(toggleModal).not.toHaveBeenCalled()
  })

  it("shows the close icon by default", () => {
    const { queryByTestId } = render(
      <CustomModal {...baseProps} toggleModal={jest.fn()} />,
    )

    expect(queryByTestId("icon-close")).toBeTruthy()
  })

  it("hides the close icon when showCloseIconButton is false", () => {
    const { queryByTestId } = render(
      <CustomModal {...baseProps} toggleModal={jest.fn()} showCloseIconButton={false} />,
    )

    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("renders every optional decoration when given one", () => {
    // One pass over the props real callers combine: header, image, title,
    // above-button note and a secondary action.
    const secondaryOnPress = jest.fn()
    const { getByTestId, getByText } = render(
      <CustomModal
        {...baseProps}
        toggleModal={jest.fn()}
        headerTitle="Header"
        headerTitleSize="h2"
        image={<React.Fragment />}
        title="Title"
        titleFontSize={18}
        titleMaxWidth="60%"
        titleTextAlignment="left"
        primaryButtonTextAbove="Read this first"
        secondaryButtonTitle="Cancel"
        secondaryButtonOnPress={secondaryOnPress}
        nonScrollingContent={<React.Fragment />}
      />,
    )

    expect(getByText("Header")).toBeTruthy()
    expect(getByText("Title")).toBeTruthy()
    expect(getByText("Read this first")).toBeTruthy()

    fireEvent.press(getByTestId("secondary-Cancel"))
    expect(secondaryOnPress).toHaveBeenCalled()
  })

  it("does not render a secondary button without a handler for it", () => {
    // A button that does nothing when pressed is worse than no button.
    const { queryByTestId } = render(
      <CustomModal
        {...baseProps}
        toggleModal={jest.fn()}
        secondaryButtonTitle="Cancel"
      />,
    )

    expect(queryByTestId("secondary-Cancel")).toBeNull()
  })

  it("renders in dark mode", () => {
    mockThemeMode = "dark"
    const { getByTestId } = render(<CustomModal {...baseProps} toggleModal={jest.fn()} />)

    expect(getByTestId("modal")).toBeTruthy()
  })

  it("falls back to its default header and title styling", () => {
    const { getByText } = render(
      <CustomModal
        {...baseProps}
        toggleModal={jest.fn()}
        headerTitle="Header"
        title="Title"
      />,
    )

    expect(getByText("Header")).toBeTruthy()
    expect(getByText("Title")).toBeTruthy()
  })

  it("renders its title on Android too", () => {
    // The title weight is the one platform-conditional style in here; a suite
    // that only ever runs as iOS would never touch the Android side.
    const original = Platform.OS
    Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true })
    try {
      const { getByText } = render(
        <CustomModal {...baseProps} toggleModal={jest.fn()} title="Title" />,
      )
      expect(getByText("Title")).toBeTruthy()
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => original, configurable: true })
    }
  })
})
