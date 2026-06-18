import React from "react"
import { render } from "@testing-library/react-native"

import { GaloyToast } from "@app/components/galoy-toast/galoy-toast"

jest.mock("react-native-toast-message", () => {
  const { View } = jest.requireActual("react-native")
  const MockToast = (_props: { config: Record<string, unknown> }) => (
    <View testID="toast" />
  )
  MockToast.show = jest.fn()
  MockToast.hide = jest.fn()

  return {
    __esModule: true,
    default: MockToast,
    SuccessToast: ({ text1 }: { text1: string }) => {
      const { Text } = jest.requireActual("react-native")
      return <Text>{text1}</Text>
    },
    ErrorToast: ({ text1 }: { text1: string }) => {
      const { Text } = jest.requireActual("react-native")
      return <Text>{text1}</Text>
    },
    WarningToast: ({ text1 }: { text1: string }) => {
      const { Text } = jest.requireActual("react-native")
      return <Text>{text1}</Text>
    },
  }
})

describe("GaloyToast", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<GaloyToast />)
    expect(getByTestId("toast")).toBeTruthy()
  })
})
