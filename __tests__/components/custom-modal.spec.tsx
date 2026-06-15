import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import CustomModal from "@app/components/custom-modal/custom-modal"

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
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
    onBackdropPress,
  }: {
    children: React.ReactNode
    isVisible: boolean
    onBackdropPress?: () => void
  }) =>
    isVisible
      ? ReactNs.createElement(
          RN.View,
          { testID: "modal" },
          ReactNs.createElement(RN.Pressable, {
            testID: "backdrop",
            onPress: onBackdropPress,
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
})
