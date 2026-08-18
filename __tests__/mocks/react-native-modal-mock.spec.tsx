import React from "react"
import { Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import ModalMock from "@mocks/react-native-modal-mock"

// Every spec that opts into this stand-in breaks with an opaque "Element type is
// invalid" far from the cause if the default export or the visibility contract
// changes. Assert the contract here so that failure lands on one file.
describe("react-native-modal mock", () => {
  it("renders children while visible", () => {
    const { getByText } = render(
      <ModalMock isVisible={true}>
        <Text>inside</Text>
      </ModalMock>,
    )

    expect(getByText("inside")).toBeTruthy()
  })

  it("renders nothing while hidden", () => {
    const { queryByText } = render(
      <ModalMock isVisible={false}>
        <Text>inside</Text>
      </ModalMock>,
    )

    expect(queryByText("inside")).toBeNull()
  })

  it("exposes both dismissal handlers the app wires up", () => {
    // custom-modal.tsx routes onBackdropPress and onBackButtonPress to
    // toggleModal; a stand-in that dropped them would delete that coverage from
    // every spec that adopts it, silently and while staying green.
    const onBackdropPress = jest.fn()
    const onBackButtonPress = jest.fn()
    const { getByTestId } = render(
      <ModalMock
        isVisible={true}
        onBackdropPress={onBackdropPress}
        onBackButtonPress={onBackButtonPress}
      >
        <Text>inside</Text>
      </ModalMock>,
    )

    fireEvent.press(getByTestId("backdrop"))
    fireEvent.press(getByTestId("back-button"))

    expect(onBackdropPress).toHaveBeenCalledTimes(1)
    expect(onBackButtonPress).toHaveBeenCalledTimes(1)
  })

  it("is importable the way jest.mock consumes it", () => {
    const required = jest.requireActual("@mocks/react-native-modal-mock")

    expect(required.__esModule).toBe(true)
    expect(typeof required.default).toBe("function")
  })
})
