import React from "react"
import { StyleSheet } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"

import { CloseHeader } from "@app/components/close-header"

import { ContextForScreen } from "../screens/helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({ navigate: mockNavigate }),
  }
})

const renderHeader = async (props: React.ComponentProps<typeof CloseHeader>) => {
  const utils = render(
    <ContextForScreen>
      <CloseHeader {...props} />
    </ContextForScreen>,
  )

  await act(async () => {})

  return utils
}

describe("CloseHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders under the given test id", async () => {
    const { getByTestId } = await renderHeader({ testID: "flow-close" })

    expect(getByTestId("flow-close")).toBeTruthy()
  })

  /** The default is what every screen in a flow relies on, so it is the load-bearing path. */
  it("leaves the flow for the home tabs when given no handler", async () => {
    const { getByTestId } = await renderHeader({ testID: "flow-close" })

    await act(async () => {
      fireEvent.press(getByTestId("flow-close"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })

  /** A screen that must not be left still holds the same layout as one that can be. */
  it("draws the row without the control when hidden", async () => {
    const { queryByTestId, toJSON } = await renderHeader({
      testID: "flow-close",
      isHidden: true,
    })

    expect(queryByTestId("flow-close")).toBeNull()
    expect(toJSON()).toBeTruthy()
  })

  it("calls the handler instead when one is given", async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderHeader({ testID: "flow-close", onClose })

    await act(async () => {
      fireEvent.press(getByTestId("flow-close"))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** No room is free under the row, so the box grows up and sideways only (48×41dp),
   *  into the row's padding, and never by a negative margin. */
  it("gives the close a 48×41dp box that takes no layout from the row", async () => {
    const { getByTestId } = await renderHeader({ testID: "flow-close" })

    const style = StyleSheet.flatten(getByTestId("flow-close").props.style)
    expect(style).toMatchObject({
      width: 48,
      height: 41,
      paddingTop: 7,
      paddingBottom: 0,
    })
    const margins = [
      style.marginTop,
      style.marginRight,
      style.marginBottom,
      style.marginLeft,
    ]
    expect(margins.filter((margin) => typeof margin === "number" && margin < 0)).toEqual(
      [],
    )
  })
})
