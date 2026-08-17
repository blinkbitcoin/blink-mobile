import React from "react"
import { Text } from "react-native"
import { render } from "@testing-library/react-native"

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

  it("is importable the way jest.mock consumes it", () => {
    const required = jest.requireActual("@mocks/react-native-modal-mock")

    expect(required.__esModule).toBe(true)
    expect(typeof required.default).toBe("function")
  })
})
