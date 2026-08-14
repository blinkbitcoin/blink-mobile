import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { NativeStackNavigationOptions } from "@react-navigation/native-stack"

import { NfcHeaderButton } from "@app/screens/receive-bitcoin-screen/nfc-header-button"

const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: mockSetOptions,
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({
    nfcIcon: {},
  }),
  useTheme: () => ({
    theme: { colors: { black: "#000" } },
  }),
}))

jest.mock("@app/components/custom-icon", () => ({
  CustomIcon: () => null,
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

describe("NfcHeaderButton", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders null (no visible output)", () => {
    const { toJSON } = render(<NfcHeaderButton visible={true} onPress={jest.fn()} />)

    expect(toJSON()).toBeNull()
  })

  it("sets a no-glass headerRight when visible is true", () => {
    render(<NfcHeaderButton visible={true} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerRight: expect.any(Function),
        // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
        unstable_headerRightItems: expect.any(Function),
      }),
    )
  })

  it("clears both header-right keys when visible is false", () => {
    render(<NfcHeaderButton visible={false} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalledWith({
      headerRight: undefined,
      // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
      unstable_headerRightItems: undefined,
    })
  })

  it("renders the NFC button through the header and forwards presses", () => {
    const onPress = jest.fn()
    render(<NfcHeaderButton visible={true} onPress={onPress} />)

    const options: NativeStackNavigationOptions = mockSetOptions.mock.calls[0][0]
    const headerRight = options.headerRight as () => React.ReactElement
    const { getByTestId } = render(headerRight())

    fireEvent.press(getByTestId("nfc-icon"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("calls setOptions on visibility change", () => {
    const { rerender } = render(<NfcHeaderButton visible={false} onPress={jest.fn()} />)

    mockSetOptions.mockClear()

    rerender(<NfcHeaderButton visible={true} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalled()
  })
})
