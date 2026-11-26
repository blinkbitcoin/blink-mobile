import React from "react"
import { render } from "@testing-library/react-native"

import { WalletToggleButton } from "@app/components/wallet-selector"

import { ContextForScreen } from "../../screens/helper"

const mockGaloyIcon = jest.fn()
jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: (props: { name: string; color: string }) => {
    mockGaloyIcon(props)
    return null
  },
}))

const buttonWith = (props: Partial<React.ComponentProps<typeof WalletToggleButton>>) =>
  render(
    <ContextForScreen>
      <WalletToggleButton
        loading={false}
        disabled={false}
        onPress={jest.fn()}
        testID="toggle"
        {...props}
      />
    </ContextForScreen>,
  )

describe("WalletToggleButton", () => {
  beforeEach(() => {
    mockGaloyIcon.mockClear()
  })

  it("offers the flip", () => {
    buttonWith({})

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({ name: "transfer" }),
    )
  })

  it("shows the one direction a top-up of the card moves in, without the flip", () => {
    const { getByTestId } = buttonWith({ isDirectionFixed: true, disabled: true })

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({ name: "arrow-down" }),
    )
    expect(getByTestId("toggle")).toBeDisabled()
  })

  it("keeps its own grey for a fixed direction, unlike a flip turned off", () => {
    const fixed = buttonWith({ isDirectionFixed: true, disabled: true })
    const fixedStyle = fixed.getByTestId("toggle").props.style
    fixed.unmount()
    const off = buttonWith({ disabled: true })
    const offStyle = off.getByTestId("toggle").props.style

    expect(fixedStyle).not.toEqual(offStyle)
  })
})
