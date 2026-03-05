import React from "react"
import { render } from "@testing-library/react-native"

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

  it("sets headerRight when visible is true", () => {
    render(<NfcHeaderButton visible={true} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerRight: expect.any(Function),
      }),
    )
  })

  it("sets empty headerRight when visible is false", () => {
    render(<NfcHeaderButton visible={false} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerRight: expect.any(Function),
      }),
    )
  })

  it("calls setOptions on visibility change", () => {
    const { rerender } = render(<NfcHeaderButton visible={false} onPress={jest.fn()} />)

    mockSetOptions.mockClear()

    rerender(<NfcHeaderButton visible={true} onPress={jest.fn()} />)

    expect(mockSetOptions).toHaveBeenCalled()
  })
})
